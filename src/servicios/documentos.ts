import ExcelJS from 'exceljs'
import JSZip from 'jszip'
import { esSuperAdmin, puedeVerEmpresa } from '@/access'
import { AppError } from '@/lib/appError'
import { registrar } from '@/lib/actividad'
import { crearTokenFirmado, leerTokenFirmado } from '@/lib/cifrado'
import type { Ctx } from '@/lib/ctx'
import { urlServidor } from '@/lib/configuracion'
import { ESTADOS, resolverGestion, type Estado } from '@/lib/estado'
import { leerFichero } from '@/lib/ficheros'
import { crearPdf } from '@/lib/pdf'
import { archivoPorId, archivosDeDocumento, documentoPorId, empresaVisible, hidratarDocumentos, listarDocumentos } from '@/datos/consultas'
import { filas } from '@/lib/db'
import { mapDocumento } from '@/datos/mapas'
import { usuarioPorId } from '@/datos/usuarios'
import type { Categoria, Documento, Empresa } from '@/datos/tipos'
import { visible } from '@/datos/mapas'

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

export async function buscarDocumentos(req: Ctx, f: Filtros) {
  const partes = [`${visible(req.user, 'empresa_id')}`]
  const params: unknown[] = []
  const add = (sql: string, valor?: unknown) => {
    params.push(valor)
    partes.push(sql.replace('?', `$${params.length}`))
  }
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`
    params.push(q, q, q, q)
    const b = params.length
    partes.push(`(titulo LIKE $${b - 3} OR referencia LIKE $${b - 2} OR organismo LIKE $${b - 1} OR observaciones LIKE $${b})`)
  }
  if (f.empresa) add('empresa_id = ?', Number(f.empresa))
  if (f.categoria) add('categoria_id = ?', Number(f.categoria))
  if (f.estados?.length) partes.push(`estado IN (${f.estados.map((e) => `'${e}'`).join(',')})`)
  if (!(esSuperAdmin(req.user) && f.estados?.includes('azul'))) partes.push(`(estado IS NULL OR estado <> 'azul')`)
  if (f.desde) add('fecha_caducidad >= ?', new Date(f.desde).toISOString())
  if (f.hasta) add('fecha_caducidad <= ?', new Date(`${f.hasta}T23:59:59`).toISOString())
  const orden = f.orden === '-createdAt' ? 'created_at DESC' : 'fecha_caducidad'
  const limite = Math.min(f.limite ?? 50, 500)
  const pagina = f.pagina ?? 1
  const where = partes.join(' AND ')
  const rows = await filas<Record<string, unknown>>(`SELECT * FROM documentos WHERE ${where} ORDER BY ${orden} LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`, params)
  const total = await filas<{ n: number }>(`SELECT COUNT(*) AS n FROM documentos WHERE ${where}`, params)
  const docs = await hidratarDocumentos(rows.map(mapDocumento))
  const totalDocs = Number(total[0]?.n ?? docs.length)
  const totalPages = Math.max(Math.ceil(totalDocs / limite), 1)
  return { docs, totalDocs, totalPages, hasPrevPage: pagina > 1, hasNextPage: pagina * limite < totalDocs }
}

export type Descargable =
  | { k: 'fichero'; c: 'archivos' | 'envios' | 'adjuntos'; i: string }
  | { k: 'zip'; ids: string[]; h?: boolean }
  | { k: 'inventario'; e: string; f: 'xlsx' | 'pdf' }
  | { k: 'historial'; e: string; d?: string }

export function enlaceFirmado(req: Ctx, datos: Descargable, minutos = 10) {
  if (!req.user) throw new AppError('No autenticado.', 401)
  const t = crearTokenFirmado({ ...datos, u: String(req.user.id) }, minutos * 60, 'descarga')
  return `${urlServidor()}/api/descarga?t=${encodeURIComponent(t)}`
}

export async function resolverEnlace(req: Ctx, token: string, historialFn: (req: Ctx, d: { empresa: string; documento?: string }) => Promise<{ data: Buffer; nombre: string; mime: string }>) {
  const datos = leerTokenFirmado<Descargable & { u: string }>(token, 'descarga')
  if (!datos) throw new AppError('El enlace ha caducado. Pida uno nuevo.', 410)
  const user = await usuarioPorId(datos.u)
  if (!user || user.activo === false) throw new AppError('Usuario no válido.', 403)
  req.user = user
  if (datos.k === 'zip') return { data: await zipDocumentos(req, datos.ids, datos.h), nombre: `Documentos ${new Date().toISOString().slice(0, 10)}.zip`, mime: 'application/zip' }
  if (datos.k === 'inventario') return inventario(req, datos.e, datos.f)
  if (datos.k === 'historial') return historialFn(req, { empresa: datos.e, documento: datos.d })
  const reg = datos.c === 'archivos' ? await archivoPorId(datos.i, user) : null
  if (!reg?.filename) throw new AppError('No tiene acceso a este archivo.', 403)
  const data = await leerFichero(datos.c, reg)
  await registrar(req, { accion: 'descarga', descripcion: `Descarga por enlace temporal de «${reg.filename}»`, empresa: idDe(reg.empresa), coleccion: datos.c, registroId: reg.id })
  return { data, nombre: reg.filename, mime: reg.mimeType ?? 'application/octet-stream' }
}

export async function zipDocumentos(req: Ctx, ids: (string | number)[], conHistorico = false) {
  if (!ids.length) throw new AppError('No ha elegido ningún documento.', 400)
  if (ids.length > 500) throw new AppError('Como máximo 500 documentos por descarga.', 400)
  const lista = ids.map(Number).join(',')
  const docs = await listarDocumentos(req.user, `AND id IN (${lista})`, [], 500)
  const zip = new JSZip()
  let n = 0
  for (const d of docs) {
    const archivos = (await archivosDeDocumento(d.id, req.user)).filter((a) => conHistorico || !a.historico)
    const carpeta = `${seguro((d.empresa as Empresa).razonSocial)}/${seguro((d.categoria as Categoria)?.nombre ?? 'Sin categoría')}/${seguro(d.titulo)}`
    for (const a of archivos) {
      const data = await leerFichero('archivos', a).catch(() => null)
      if (!data || !a.filename) continue
      zip.file(`${carpeta}/${a.historico ? 'historico/' : ''}${seguro(a.filename)}`, data)
      n++
    }
  }
  if (!n) throw new AppError('Los documentos elegidos no tienen archivos.', 404)
  const empresas = [...new Set(docs.map((d) => String(idDe(d.empresa))))]
  await registrar(req, { accion: 'descarga', descripcion: `Descarga en ZIP de ${n} archivos de ${docs.length} documentos`, empresa: empresas.length === 1 ? empresas[0] : null, coleccion: 'documentos', datos: { documentos: docs.map((d) => d.id) } })
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export async function inventario(req: Ctx, empresaId: string | number, formato: 'xlsx' | 'pdf') {
  if (!puedeVerEmpresa(req.user, empresaId)) throw new AppError('No tiene acceso a esa empresa.', 403)
  const empresa = await empresaVisible(req.user, empresaId)
  if (!empresa) throw new AppError('No tiene acceso a esa empresa.', 403)
  const docs = await listarDocumentos(req.user, 'AND empresa_id = $1 ORDER BY fecha_caducidad', [Number(empresa.id)], 10000)
  const filasDoc = (docs as Documento[])
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
    filasDoc.forEach((f) => ws.addRow(f))
    return { data: Buffer.from(await wb.xlsx.writeBuffer()), nombre, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
  }
  const pdf = await crearPdf(`Inventario documental · ${empresa.razonSocial}`, `CIF ${empresa.cif} · ${filasDoc.length} documentos · generado el ${hoy}`)
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
    filasDoc.map((f) => [f.categoria, f.titulo, f.referencia, f.organismo, f.caducidad, f.aviso, f.estado + (f.condicionado ? ' (condicionado)' : ''), f.gestion]),
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
