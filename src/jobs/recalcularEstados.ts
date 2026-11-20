import { filas } from '@/lib/db'
import { mapDocumento } from '@/datos/mapas'
import { hidratarDocumentos } from '@/datos/consultas'
import { recalcularColor } from '@/datos/operaciones'
import type { Categoria, Documento, Empresa } from '@/datos/tipos'
import { hitoDeHoy, type Hito } from '@/lib/avisos'
import { ctxSistema, type Ctx } from '@/lib/ctx'
import { leerConfiguracion, urlServidor, type Config } from '@/lib/configuracion'
import { programarCorreo } from '@/lib/correo'
import { destinatariosCliente, destinatariosCMC, tecnicoResponsable } from '@/lib/destinatarios'
import { resolverGestion } from '@/lib/estado'
import { almacenamiento } from '@/lib/estadisticas'
import { tamano } from '@/lib/subidas'
import type { ClavePlantilla } from '@/lib/plantillas'

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

async function avisar(req: Ctx, doc: Documento, hito: Hito) {
  const empresa = doc.empresa as Empresa
  const cat = doc.categoria as Categoria
  const gestionado = resolverGestion(empresa.gestion, cat?.gestion, doc.gestion) === 'gestionado'
  const cliente = await destinatariosCliente(req, empresa)
  const cmc = await destinatariosCMC(req)
  const tec = gestionado ? await tecnicoResponsable(req, doc, cat, empresa) : null
  const tecnico = tec ? [{ email: tec.email, usuario: tec.id, tipo: 'cmc' as const }] : cmc
  const vars = { documento: doc.titulo, empresa: empresa.razonSocial, caducidad: fmt(doc.fechaCaducidad), dias: 'dias' in hito ? hito.dias : '', tecnico: tec?.nombre ?? 'CMC' }
  const base = { vars, empresa: empresa.id, documento: doc.id, idempotencia: `${hito.clave}|doc${doc.id}` }
  const enlace = `${urlServidor()}/portal/documentos/${doc.id}`
  const envios: { plantilla: ClavePlantilla; para: typeof cliente; enlace: string }[] = []
  if (hito.tipo === 'proxima') {
    envios.push({ plantilla: gestionado ? 'proxima_gestionado' : 'proxima_no_gestionado', para: cliente, enlace })
    if (gestionado) envios.push({ plantilla: 'proxima_tecnico', para: tecnico, enlace })
  } else if (hito.tipo === 'recordatorio') {
    envios.push(gestionado ? { plantilla: 'recordatorio_tecnico', para: tecnico, enlace } : { plantilla: 'recordatorio_no_gestionado', para: cliente, enlace })
  } else if (hito.tipo === 'caducado') {
    if (gestionado) {
      envios.push({ plantilla: 'caducado_tecnico', para: [...tecnico, ...cmc], enlace })
      envios.push({ plantilla: 'caducado_gestionado', para: cliente, enlace })
    } else {
      envios.push({ plantilla: 'caducado_no_gestionado', para: cliente, enlace })
      envios.push({ plantilla: 'caducado_no_gestionado', para: cmc, enlace })
    }
  } else {
    envios.push(gestionado ? { plantilla: 'recordatorio_caducado_tecnico', para: tecnico, enlace } : { plantilla: 'recordatorio_caducado_no_gestionado', para: cliente, enlace })
  }
  for (const e of envios) await programarCorreo(req, { ...base, ...e })
}

async function revisarAlmacenamiento(req: Ctx, cfg: Config) {
  const uso = await almacenamiento()
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

export async function recalcularEstados() {
  const req = ctxSistema()
  const cfg = await leerConfiguracion()
  let offset = 0
  let cambiados = 0
  let avisos = 0
  for (;;) {
    const rows = await filas<Record<string, unknown>>(`SELECT * FROM documentos WHERE estado NOT IN ('negro', 'azul') ORDER BY id LIMIT 200 OFFSET $1`, [offset])
    if (!rows.length) break
    const docs = await hidratarDocumentos(rows.map(mapDocumento))
    for (const d of docs) {
      const antes = d.estado
      const actual = await recalcularColor(req, d.id)
      if (actual && actual.estado !== antes) cambiados++
      const empresa = (actual ?? d).empresa as Empresa
      if (!empresa?.activa) continue
      const hito = hitoDeHoy(actual ?? d, cfg)
      if (hito) {
        await avisar(req, actual ?? d, hito)
        avisos++
      }
    }
    if (rows.length < 200) break
    offset += 200
  }
  await revisarAlmacenamiento(req, cfg)
  return { cambiados, avisos }
}

export async function resumenSemanal() {
  const req = ctxSistema()
  const rows = await filas<Record<string, unknown>>(
    `SELECT d.* FROM documentos d JOIN empresas e ON e.id = d.empresa_id WHERE d.estado IN ('amarillo', 'rojo') AND e.activa IS NOT FALSE ORDER BY d.fecha_caducidad LIMIT 2000`,
  )
  const docs = await hidratarDocumentos(rows.map(mapDocumento))
  if (!docs.length) return { total: 0 }
  const lineas = docs.map((d) => `• ${(d.empresa as Empresa).razonSocial} — ${d.titulo}: ${d.estado === 'rojo' ? 'caducado' : 'caduca'} el ${fmt(d.fechaCaducidad)}`)
  const semana = new Date().toISOString().slice(0, 10)
  await programarCorreo(req, {
    plantilla: 'resumen_semanal',
    para: await destinatariosCMC(req),
    vars: { total: docs.length, resumen: lineas.slice(0, 300).join('\n') + (lineas.length > 300 ? `\n… y ${lineas.length - 300} más` : '') },
    enlace: `${urlServidor()}/portal`,
    idempotencia: `resumen|${semana}`,
  })
  return { total: docs.length }
}
