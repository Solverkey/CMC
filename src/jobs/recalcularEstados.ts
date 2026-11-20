import type { PayloadRequest, TaskConfig } from 'payload'
import type { Categoria, Documento, Empresa } from '@/payload-types'
import { hitoDeHoy, type Hito } from '../lib/avisos'
import { leerConfiguracion, urlServidor, type Config } from '../lib/configuracion'
import { programarCorreo } from '../lib/correo'
import { destinatariosCliente, destinatariosCMC, tecnicoResponsable } from '../lib/destinatarios'
import { calcularEstado, resolverGestion } from '../lib/estado'
import { almacenamiento } from '../lib/estadisticas'
import { tamano } from '../lib/subidas'
import type { ClavePlantilla } from '../lib/plantillas'

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

/**
 * Avisos de un documento según su modalidad (informe, apartado 6):
 * - No gestionado: toda la secuencia al cliente; si caduca, también a CMC.
 * - Gestionado: al cliente solo el aviso inicial y el de caducidad («CMC lo está tramitando»);
 *   al técnico responsable toda la secuencia; si caduca, también al super administrador.
 */
async function avisar(req: PayloadRequest, doc: Documento, hito: Hito) {
  const empresa = doc.empresa as Empresa
  const cat = doc.categoria as Categoria
  const gestionado = resolverGestion(empresa.gestion, cat?.gestion, doc.gestion) === 'gestionado'
  const cliente = await destinatariosCliente(req, empresa)
  const cmc = await destinatariosCMC(req)
  const tec = gestionado ? await tecnicoResponsable(req, doc, cat, empresa) : null
  const tecnico = tec ? [{ email: tec.email, usuario: tec.id, tipo: 'cmc' as const }] : cmc
  const vars = {
    documento: doc.titulo,
    empresa: empresa.razonSocial,
    caducidad: fmt(doc.fechaCaducidad),
    dias: 'dias' in hito ? hito.dias : '',
    tecnico: tec?.nombre ?? 'CMC',
  }
  const base = { vars, empresa: empresa.id, documento: doc.id, idempotencia: `${hito.clave}|doc${doc.id}` }
  const enlaceCliente = `${urlServidor()}/portal/documentos/${doc.id}`
  const enlaceCMC = `${urlServidor()}/portal/documentos/${doc.id}`
  const envios: { plantilla: ClavePlantilla; para: typeof cliente; enlace: string }[] = []

  if (hito.tipo === 'proxima') {
    envios.push({ plantilla: gestionado ? 'proxima_gestionado' : 'proxima_no_gestionado', para: cliente, enlace: enlaceCliente })
    if (gestionado) envios.push({ plantilla: 'proxima_tecnico', para: tecnico, enlace: enlaceCMC })
  } else if (hito.tipo === 'recordatorio') {
    envios.push(gestionado ? { plantilla: 'recordatorio_tecnico', para: tecnico, enlace: enlaceCMC } : { plantilla: 'recordatorio_no_gestionado', para: cliente, enlace: enlaceCliente })
  } else if (hito.tipo === 'caducado') {
    if (gestionado) {
      envios.push({ plantilla: 'caducado_tecnico', para: [...tecnico, ...cmc], enlace: enlaceCMC })
      envios.push({ plantilla: 'caducado_gestionado', para: cliente, enlace: enlaceCliente })
    } else {
      envios.push({ plantilla: 'caducado_no_gestionado', para: cliente, enlace: enlaceCliente })
      envios.push({ plantilla: 'caducado_no_gestionado', para: cmc, enlace: enlaceCMC })
    }
  } else {
    envios.push(gestionado ? { plantilla: 'recordatorio_caducado_tecnico', para: tecnico, enlace: enlaceCMC } : { plantilla: 'recordatorio_caducado_no_gestionado', para: cliente, enlace: enlaceCliente })
  }
  for (const e of envios) await programarCorreo(req, { ...base, ...e })
}

async function revisarAlmacenamiento(req: PayloadRequest, cfg: Config) {
  const uso = await almacenamiento(req.payload)
  const limite = cfg.limiteGB * 1024 ** 3
  const pct = Math.round((uso.total / limite) * 100)
  if (pct < cfg.avisoPorcentaje) return
  const mes = new Date().toISOString().slice(0, 7)
  await programarCorreo(req, {
    plantilla: 'almacenamiento',
    para: await destinatariosCMC(req),
    vars: { uso: pct, consumido: tamano(uso.total), limite: `${cfg.limiteGB} GB` },
    enlace: `${urlServidor()}/portal/almacenamiento`,
    idempotencia: `almacenamiento|${mes}|${pct >= 100 ? 100 : cfg.avisoPorcentaje}`,
  })
}

/** Cada noche: recalcula el semáforo (las fechas avanzan aunque nadie edite) y programa los avisos del día. */
export const recalcularEstados: TaskConfig<'recalcularEstados'> = {
  slug: 'recalcularEstados',
  retries: 3,
  schedule: [{ cron: '0 3 * * *', queue: 'nocturna' }],
  handler: async ({ req }) => {
    req.context.origen = 'sistema'
    const cfg = await leerConfiguracion(req.payload, req)
    let page = 1
    let cambiados = 0
    let avisos = 0
    for (;;) {
      const res = await req.payload.find({ collection: 'documentos', limit: 200, page, depth: 1, overrideAccess: true, req, where: { and: [{ estado: { not_equals: 'negro' } }, { estado: { not_equals: 'azul' } }] } })
      for (const d of res.docs) {
        const nuevo = calcularEstado(d)
        if (nuevo !== d.estado) {
          await req.payload.update({ collection: 'documentos', id: d.id, data: { estado: nuevo }, overrideAccess: true, req })
          d.estado = nuevo
          cambiados++
        }
        const empresa = d.empresa as Empresa
        if (!empresa?.activa) continue
        const hito = hitoDeHoy(d, cfg)
        if (hito) {
          await avisar(req, d, hito)
          avisos++
        }
      }
      if (!res.hasNextPage) break
      page++
    }
    await revisarAlmacenamiento(req, cfg)
    return { output: { cambiados, avisos } }
  },
}

/** Cada lunes: resumen para CMC con los documentos de caducidad próxima y caducados. */
export const resumenSemanal: TaskConfig<'resumenSemanal'> = {
  slug: 'resumenSemanal',
  retries: 3,
  schedule: [{ cron: '0 7 * * 1', queue: 'nocturna' }],
  handler: async ({ req }) => {
    req.context.origen = 'sistema'
    const { docs } = await req.payload.find({ collection: 'documentos', where: { estado: { in: ['amarillo', 'rojo'] }, 'empresa.activa': { equals: true } }, sort: 'fechaCaducidad', limit: 2000, depth: 1, overrideAccess: true, req })
    if (!docs.length) return { output: { total: 0 } }
    const lineas = docs.map((d) => `• ${(d.empresa as Empresa).razonSocial} — ${d.titulo}: ${d.estado === 'rojo' ? 'caducado' : 'caduca'} el ${fmt(d.fechaCaducidad)}`)
    const semana = new Date().toISOString().slice(0, 10)
    await programarCorreo(req, {
      plantilla: 'resumen_semanal',
      para: await destinatariosCMC(req),
      vars: { total: docs.length, resumen: lineas.slice(0, 300).join('\n') + (lineas.length > 300 ? `\n… y ${lineas.length - 300} más` : '') },
      enlace: `${urlServidor()}/portal`,
      idempotencia: `resumen|${semana}`,
    })
    return { output: { total: docs.length } }
  },
}
