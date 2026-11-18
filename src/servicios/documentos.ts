import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import type { PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import type { Archivo, Categoria, Documento, Empresa } from '@/payload-types'
import { puedeVerEmpresa } from '../access'
import { registrar } from '../lib/actividad'
import { crearTokenFirmado, leerTokenFirmado } from '../lib/cifrado'
import { urlServidor } from '../lib/configuracion'
import { ESTADOS, resolverGestion, type Estado } from '../lib/estado'
import { leerFichero } from '../lib/ficheros'
import { crearPdf } from '../lib/pdf'

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string))
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')
const seguro = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 120)

export type Filtros = {
  q?: string
  empresa?: string | number
  categoria?: string | number
  estados?: Estado[]
  desde?: string
  hasta?: string
  limite?: number
  pagina?: number
  orden?: string
}

/** Buscador (RF-16): texto y filtros por empresa, categoría, estado y rango de fechas de caducidad. */
export async function buscarDocumentos(req: PayloadRequest, f: Filtros) {
  const and: Where[] = []
  if (f.q?.trim()) {
    const q = f.q.trim()
    and.push({ or: [{ titulo: { like: q } }, { referencia: { like: q } }, { organismo: { like: q } }, { observaciones: { like: q } }, { etiquetas: { like: q } }] })
  }
  if (f.empresa) and.push({ empresa: { equals: f.empresa } })
  if (f.categoria) and.push({ categoria: { equals: f.categoria } })
  if (f.estados?.length) and.push({ estado: { in: f.estados } })
  if (f.desde) and.push({ fechaCaducidad: { greater_than_equal: new Date(f.desde).toISOString() } })
  if (f.hasta) and.push({ fechaCaducidad: { less_than_equal: new Date(`${f.hasta}T23:59:59`).toISOString() } })
  return req.payload.find({
    collection: 'documentos',
    where: and.length ? { and } : undefined,
    user: req.user,
    overrideAccess: false,
    depth: 1,
    limit: Math.min(f.limite ?? 50, 500),
    page: f.pagina ?? 1,
    sort: f.orden ?? 'fechaCaducidad',
    req,
  })
}

export type Descargable =
  | { k: 'fichero'; c: 'archivos' | 'envios' | 'adjuntos'; i: string }
  | { k: 'zip'; ids: string[]; h?: boolean }
  | { k: 'inventario'; e: string; f: 'xlsx' | 'pdf' }
  | { k: 'historial'; e: string; d?: string }

/**
 * Enlace de descarga temporal (por defecto 10 minutos). Los permisos se vuelven a comprobar al descargar,
 * con el usuario que lo pidió. Se usa desde el asistente de IA, que no puede recibir ficheros.
 */
export function enlaceFirmado(req: PayloadRequest, datos: Descargable, minutos = 10) {
  if (!req.user) throw new APIError('No autenticado.', 401)
  const t = crearTokenFirmado({ ...datos, u: String(req.user.id) }, minutos * 60, 'descarga')
  return `${urlServidor()}/api/descarga?t=${encodeURIComponent(t)}`
}

export async function resolverEnlace(req: PayloadRequest, token: string, historialFn: (req: PayloadRequest, d: { empresa: string; documento?: string }) => Promise<{ data: Buffer; nombre: string; mime: string }>) {
  const datos = leerTokenFirmado<Descargable & { u: string }>(token, 'descarga')
  if (!datos) throw new APIError('El enlace ha caducado. Pida uno nuevo.', 410, null, true)
  const user = await req.payload.findByID({ collection: 'users', id: datos.u, depth: 0, overrideAccess: true, req }).catch(() => null)
  if (!user || user.activo === false) throw new APIError('Usuario no válido.', 403, null, true)
  req.user = { ...user, collection: 'users' } as typeof req.user
  if (datos.k === 'zip') return { data: await zipDocumentos(req, datos.ids, datos.h), nombre: `Documentos ${new Date().toISOString().slice(0, 10)}.zip`, mime: 'application/zip' }
  if (datos.k === 'inventario') return inventario(req, datos.e, datos.f)
  if (datos.k === 'historial') return historialFn(req, { empresa: datos.e, documento: datos.d })
  const reg = (await req.payload.findByID({ collection: datos.c, id: datos.i, depth: 0, user: req.user, overrideAccess: false, req }).catch(() => null)) as (Archivo & { empresa?: unknown }) | null
  if (!reg) throw new APIError('No tiene acceso a este archivo.', 403, null, true)
  const data = await leerFichero(req.payload, datos.c, reg)
  await registrar(req, { accion: 'descarga', descripcion: `Descarga por enlace temporal de «${reg.filename}»`, empresa: idDe(reg.empresa), coleccion: datos.c, registroId: reg.id })
  return { data, nombre: reg.filename!, mime: reg.mimeType ?? 'application/octet-stream' }
}

/** Descarga en ZIP del archivo vigente de varios documentos, en carpetas por categoría (RF-09). */
export async function zipDocumentos(req: PayloadRequest, ids: (string | number)[], conHistorico = false) {
  if (!ids.length) throw new APIError('No ha elegido ningún documento.', 400, null, true)
  if (ids.length > 500) throw new APIError('Como máximo 500 documentos por descarga.', 400, null, true)
  const { docs } = await req.payload.find({ collection: 'documentos', where: { id: { in: ids } }, user: req.user, overrideAccess: false, depth: 1, limit: 500, req })
  const zip = new JSZip()
  let n = 0
  for (const d of docs) {
    const where: Where = conHistorico ? { documento: { equals: d.id } } : { and: [{ documento: { equals: d.id } }, { historico: { equals: false } }] }
    const archivos = await req.payload.find({ collection: 'archivos', where, user: req.user, overrideAccess: false, depth: 0, limit: 100, req })
    const carpeta = `${seguro((d.empresa as Empresa).razonSocial)}/${seguro((d.categoria as Categoria)?.nombre ?? 'Sin categoría')}/${seguro(d.titulo)}`
    for (const a of archivos.docs) {
      const data = await leerFichero(req.payload, 'archivos', a).catch(() => null)
      if (!data) continue
      zip.file(`${carpeta}/${a.historico ? 'historico/' : ''}${seguro(a.filename!)}`, data)
      n++
    }
  }
  if (!n) throw new APIError('Los documentos elegidos no tienen archivos.', 404, null, true)
  const empresas = [...new Set(docs.map((d) => idDe(d.empresa)))]
  await registrar(req, { accion: 'descarga', descripcion: `Descarga en ZIP de ${n} archivos de ${docs.length} documentos`, empresa: empresas.length === 1 ? empresas[0] : null, coleccion: 'documentos', datos: { documentos: docs.map((d) => d.id) } })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

/** Inventario documental de una empresa con su estado, en Excel o PDF (RF-19). */
export async function inventario(req: PayloadRequest, empresaId: string | number, formato: 'xlsx' | 'pdf') {
  if (!puedeVerEmpresa(req.user, empresaId)) throw new APIError('No tiene acceso a esa empresa.', 403, null, true)
  const empresa = (await req.payload.findByID({ collection: 'empresas', id: empresaId, user: req.user, overrideAccess: false, depth: 0, req })) as Empresa
  const { docs } = await req.payload.find({ collection: 'documentos', where: { empresa: { equals: empresa.id } }, user: req.user, overrideAccess: false, depth: 1, limit: 10000, sort: 'fechaCaducidad', req })
  const filas = (docs as Documento[])
    .map((d) => {
      const cat = d.categoria as Categoria
      return {
        categoria: cat?.nombre ?? '',
        orden: cat?.orden ?? 0,
        titulo: d.titulo,
        referencia: d.referencia ?? '',
        organismo: d.organismo ?? '',
        emision: fmt(d.fechaEmision),
        caducidad: d.fechaCaducidad ? fmt(d.fechaCaducidad) : 'Indefinido',
        aviso: fmt(d.fechaAviso),
        estado: ESTADOS[d.estado as Estado]?.label ?? '',
        condicionado: d.estadoManual === 'naranja' && d.estado !== 'naranja' ? 'Sí' : '',
        gestion: resolverGestion(empresa.gestion, cat?.gestion, d.gestion) === 'gestionado' ? 'Gestionado por CMC' : 'No gestionado',
      }
    })
    .sort((a, b) => a.orden - b.orden || a.categoria.localeCompare(b.categoria, 'es'))
  const hoy = new Date().toLocaleDateString('es-ES')
  await registrar(req, { accion: 'exportacion', descripcion: `Exportación del inventario de «${empresa.razonSocial}» (${formato.toUpperCase()})`, empresa: empresa.id, coleccion: 'empresas', registroId: empresa.id })
  const nombre = `Inventario ${seguro(empresa.razonSocial)} ${new Date().toISOString().slice(0, 10)}.${formato}`

  if (formato === 'xlsx') {
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Portal documental CMC'
    const ws = wb.addWorksheet('Inventario')
    ws.columns = [
      { header: 'Categoría', key: 'categoria', width: 22 },
      { header: 'Documento', key: 'titulo', width: 42 },
      { header: 'Referencia', key: 'referencia', width: 16 },
      { header: 'Organismo emisor', key: 'organismo', width: 22 },
      { header: 'Emisión', key: 'emision', width: 12 },
      { header: 'Caducidad', key: 'caducidad', width: 12 },
      { header: 'Aviso', key: 'aviso', width: 12 },
      { header: 'Estado', key: 'estado', width: 18 },
      { header: 'Condicionado', key: 'condicionado', width: 13 },
      { header: 'Modalidad', key: 'gestion', width: 20 },
    ]
    ws.getRow(1).font = { bold: true }
    ws.views = [{ state: 'frozen', ySplit: 1 }]
    ws.autoFilter = { from: 'A1', to: 'J1' }
    filas.forEach((f) => ws.addRow(f))
    const colores: Record<string, string> = { Vigente: 'FFE1EFE4', 'Caducidad próxima': 'FFFAEFC2', Condicionada: 'FFFBE5D3', Caducada: 'FFF8DEDB', 'Pasado o archivado': 'FFD9E6F5', 'No legalizado': 'FFE6E4DC' }
    ws.eachRow((row, i) => {
      if (i === 1) return
      const c = colores[String(row.getCell(8).value)]
      if (c) row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c } }
    })
    return { data: Buffer.from(await wb.xlsx.writeBuffer()), nombre, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  }

  const pdf = await crearPdf(`Inventario documental · ${empresa.razonSocial}`, `CIF ${empresa.cif} · ${filas.length} documentos · generado el ${hoy}`)
  pdf.tabla(
    [
      { titulo: 'Categoría', ancho: 100 },
      { titulo: 'Documento', ancho: 200 },
      { titulo: 'Referencia', ancho: 80 },
      { titulo: 'Organismo', ancho: 100 },
      { titulo: 'Caducidad', ancho: 62 },
      { titulo: 'Aviso', ancho: 62 },
      { titulo: 'Estado', ancho: 80 },
      { titulo: 'Modalidad', ancho: 78 },
    ],
    filas.map((f) => [f.categoria, f.titulo, f.referencia, f.organismo, f.caducidad, f.aviso, f.estado + (f.condicionado ? ' (condicionado)' : ''), f.gestion]),
  )
  return { data: await pdf.guardar(), nombre, mime: 'application/pdf' }
}

export const descargable = ({ data, nombre, mime }: { data: Buffer; nombre: string; mime: string }, inline = false) =>
  new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': mime,
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      'Cache-Control': 'private, no-store',
    },
  })
