import { puedeVerEmpresa } from '@/access'
import { AppError } from '@/lib/appError'
import type { Ctx } from '@/lib/ctx'
import { leerConfiguracion } from '@/lib/configuracion'
import { resolverGestion } from '@/lib/estado'
import { empresaVisible, listarDocumentos, correosDeEmpresa } from '@/datos/consultas'
import type { Categoria } from '@/datos/tipos'

export type AvisoProgramado = { fecha: string; tipo: string; documento: { id: number | string; titulo: string }; gestionado: boolean }

export async function centroAvisos(req: Ctx, empresaId: string | number, dias = 120) {
  if (!puedeVerEmpresa(req.user, empresaId)) throw new AppError('No tiene acceso a esa empresa.', 403)
  const cfg = await leerConfiguracion()
  const empresa = await empresaVisible(req.user, empresaId)
  if (!empresa) throw new AppError('No tiene acceso a esa empresa.', 403)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const limite = new Date(hoy.getTime() + dias * 86_400_000)
  const docs = await listarDocumentos(
    req.user,
    `AND empresa_id = $1 AND estado NOT IN ('negro', 'azul') AND fecha_caducidad IS NOT NULL AND fecha_aviso <= $2`,
    [Number(empresa.id), limite.toISOString()],
    1000,
  )
  const enviados = await correosDeEmpresa(empresa.id, 50)
  const proximos: AvisoProgramado[] = []
  for (const d of docs) {
    const cat = d.categoria as Categoria
    const gestionado = resolverGestion(empresa.gestion, cat?.gestion, d.gestion) === 'gestionado'
    const cad = new Date(d.fechaCaducidad!)
    const aviso = d.fechaAviso ? new Date(d.fechaAviso) : cad
    const recordatorio = new Date(cad.getTime() - cfg.recordatorioDiasAntes * 86_400_000)
    const hitos: [Date, string][] = [[aviso, 'proxima'], ...(recordatorio > aviso && !gestionado ? ([[recordatorio, 'recordatorio']] as [Date, string][]) : []), [cad, 'caducado']]
    for (const [fecha, tipo] of hitos) {
      if (fecha >= hoy && fecha <= limite) proximos.push({ fecha: fecha.toISOString(), tipo, documento: { id: d.id, titulo: d.titulo }, gestionado })
    }
  }
  proximos.sort((a, b) => a.fecha.localeCompare(b.fecha))
  return { empresa, proximos, enviados }
}
