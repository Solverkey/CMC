import type { PayloadRequest } from 'payload'
import { APIError } from 'payload'
import type { Categoria, Documento, Empresa } from '@/payload-types'
import { puedeVerEmpresa } from '../access'
import { leerConfiguracion } from '../lib/configuracion'
import { resolverGestion } from '../lib/estado'

export type AvisoProgramado = { fecha: string; tipo: string; documento: { id: number | string; titulo: string }; gestionado: boolean }

/** Centro de notificaciones (RF-18): avisos enviados y próximos avisos programados de una empresa. */
export async function centroAvisos(req: PayloadRequest, empresaId: string | number, dias = 120) {
  if (!puedeVerEmpresa(req.user, empresaId)) throw new APIError('No tiene acceso a esa empresa.', 403, null, true)
  const cfg = await leerConfiguracion(req.payload, req)
  const empresa = (await req.payload.findByID({ collection: 'empresas', id: empresaId, depth: 0, user: req.user, overrideAccess: false, req })) as Empresa
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const limite = new Date(hoy.getTime() + dias * 86_400_000)

  const [docs, enviados] = await Promise.all([
    req.payload.find({
      collection: 'documentos',
      where: { and: [{ empresa: { equals: empresa.id } }, { estado: { not_equals: 'negro' } }, { estado: { not_equals: 'azul' } }, { fechaCaducidad: { exists: true } }, { fechaAviso: { less_than_equal: limite.toISOString() } }] },
      depth: 1,
      limit: 1000,
      user: req.user,
      overrideAccess: false,
      req,
    }),
    req.payload.find({ collection: 'correos', where: { empresa: { equals: empresa.id } }, sort: '-createdAt', limit: 50, depth: 0, user: req.user, overrideAccess: false, req }),
  ])

  const proximos: AvisoProgramado[] = []
  for (const d of docs.docs as Documento[]) {
    const gestionado = resolverGestion(empresa.gestion, (d.categoria as Categoria)?.gestion, d.gestion) === 'gestionado'
    const cad = new Date(d.fechaCaducidad!)
    const aviso = d.fechaAviso ? new Date(d.fechaAviso) : cad
    const recordatorio = new Date(cad.getTime() - cfg.recordatorioDiasAntes * 86_400_000)
    const hitos: [Date, string][] = [
      [aviso, 'Aviso de caducidad próxima'],
      ...(recordatorio > aviso && !gestionado ? ([[recordatorio, `Recordatorio ${cfg.recordatorioDiasAntes} días antes`]] as [Date, string][]) : []),
      [cad, 'Aviso de documento caducado'],
    ]
    for (const [fecha, tipo] of hitos) {
      if (fecha >= hoy && fecha <= limite) proximos.push({ fecha: fecha.toISOString(), tipo, documento: { id: d.id, titulo: d.titulo }, gestionado })
    }
  }
  proximos.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return { empresa, proximos, enviados: enviados.docs }
}
