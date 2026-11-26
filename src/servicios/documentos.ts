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
import { archivoPorId, archivosDeDocumento, empresaVisible, hidratarDocumentos, listarDocumentos } from '@/datos/consultas'
import { filas, uno } from '@/lib/db'
import { mapDocumento } from '@/datos/mapas'
import { usuarioPorId } from '@/datos/usuarios'
import type { Categoria, Documento, Empresa, User } from '@/datos/tipos'
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

const ESTADOS_VALIDOS = new Set<string>(['verde', 'amarillo', 'naranja', 'rojo', 'azul', 'negro'])

/** AAAA-MM-DD a ISO; lo que no sea una fecha se ignora en lugar de romper la página. */
export const fechaValida = (v?: string | null, hora = '') => {
  if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null
  const d = new Date(`${v.slice(0, 10)}${hora}`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Orden de la lista. Por defecto, lo urgente primero: caducados, no legalizados, caducidad próxima, condicionados. */
export const ORDENES = {
  urgencia: { texto: 'Urgencia', sql: "CASE estado WHEN 'rojo' THEN 0 WHEN 'negro' THEN 1 WHEN 'amarillo' THEN 2 WHEN 'naranja' THEN 3 WHEN 'verde' THEN 4 ELSE 5 END, fecha_caducidad IS NULL, fecha_caducidad, titulo" },
  caducidad: { texto: 'Fecha de caducidad', sql: 'fecha_caducidad IS NULL, fecha_caducidad, titulo' },
  nombre: { texto: 'Nombre', sql: 'LOWER(titulo), id' },
  recientes: { texto: 'Últimos añadidos', sql: 'created_at DESC, id DESC' },
} as const
export type Orden = keyof typeof ORDENES

/** Cuántos documentos hay de cada color con los demás filtros: los botones de estado de la lista. */
export async function contarPorEstado(req: Ctx, f: Filtros) {
  const { where, params } = condiciones(req, f, { conEstados: false })
  const rows = await filas<{ estado: string | null; n: number }>(`SELECT estado, COUNT(*) AS n FROM documentos WHERE ${where} GROUP BY estado`, params)
  const cuenta: Record<string, number> = {}
  for (const r of rows) cuenta[r.estado ?? 'verde'] = (cuenta[r.estado ?? 'verde'] ?? 0) + Number(r.n)
  return cuenta
}

export async function buscarDocumentos(req: Ctx, f: Filtros) {
  const { where, params } = condiciones(req, f)
  const orden = f.orden === '-createdAt' ? ORDENES.recientes.sql : (ORDENES[f.orden as Orden] ?? ORDENES.urgencia).sql
  const limite = Math.min(f.limite ?? 50, 500)
  const pagina = f.pagina ?? 1
  const rows = await filas<Record<string, unknown>>(`SELECT * FROM documentos WHERE ${where} ORDER BY ${orden} LIMIT ${limite} OFFSET ${(pagina - 1) * limite}`, params)
  const total = await filas<{ n: number }>(`SELECT COUNT(*) AS n FROM documentos WHERE ${where}`, params)
  const docs = await hidratarDocumentos(rows.map(mapDocumento))
  const totalDocs = Number(total[0]?.n ?? docs.length)
  const totalPages = Math.max(Math.ceil(totalDocs / limite), 1)
  return { docs, totalDocs, totalPages, hasPrevPage: pagina > 1, hasNextPage: pagina * limite < totalDocs }
}

/** Condiciones de la búsqueda. Sin `conEstados`, sirven para contar cuántos hay de cada color con los demás filtros. */
function condiciones(req: Ctx, f: Filtros, { conEstados = true } = {}) {
  const partes = [`${visible(req.user, 'empresa_id')}`]
  const params: unknown[] = []
  const add = (sql: string, valor?: unknown) => {
    params.push(valor)
    partes.push(sql.replace('?', `$${params.length}`))
  }
  if (f.q?.trim()) {
    // LOWER en los dos lados: en Postgres LIKE distingue mayúsculas.
    params.push(`%${f.q.trim().toLowerCase()}%`)
    const b = `$${params.length}`
    partes.push(`(LOWER(titulo) LIKE ${b} OR LOWER(referencia) LIKE ${b} OR LOWER(organismo) LIKE ${b} OR LOWER(observaciones) LIKE ${b})`)
  }
  if (f.empresa) add('empresa_id = ?', Number(f.empresa))
  if (f.categoria) add('categoria_id = ?', Number(f.categoria))
  // Los estados llegan de la URL: solo se aceptan los conocidos y van como parámetros, nunca pegados al SQL.
  const estados = conEstados ? (f.estados ?? []).filter((e) => ESTADOS_VALIDOS.has(e)) : []
  if (estados.length) {
    const marcas = estados.map((e) => {
      params.push(e)
      return `$${params.length}`
    })
    partes.push(`estado IN (${marcas.join(',')})`)
  }
  // Los archivados (azul) solo los ve CMC: al buscar, si los pide; al contar, siempre.
  const cmc = esSuperAdmin(req.user)
  if (!cmc || (conEstados && !estados.includes('azul'))) partes.push(`(estado IS NULL OR estado <> 'azul')`)
  const desde = fechaValida(f.desde)
  const hasta = fechaValida(f.hasta, 'T23:59:59')
  if (desde) add('fecha_caducidad >= ?', desde)
  if (hasta) add('fecha_caducidad <= ?', hasta)
  return { where: partes.join(' AND '), params }
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

/** Envío o adjunto de una empresa visible para el usuario (mismo filtro que el resto del portal). */
async function ficheroVisible(coleccion: 'envios' | 'adjuntos', id: string, user: User) {
  const row = await uno<Record<string, unknown>>(`SELECT id, empresa_id, filename, mime_type FROM ${coleccion} WHERE id = $1 AND ${visible(user, 'empresa_id')}`, [Number(id)])
  if (!row?.filename) return null
  return { id: Number(row.id), empresa: Number(row.empresa_id), filename: String(row.filename), mimeType: row.mime_type == null ? null : String(row.mime_type) }
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
  const reg = datos.c === 'archivos' ? await archivoPorId(datos.i, user) : await ficheroVisible(datos.c, datos.i, user)
  if (!reg?.filename) throw new AppError('No tiene acceso a este archivo.', 403)
  const data = await leerFichero(datos.c, reg)
  await registrar(req, { accion: 'descarga', descripcion: `Descarga por enlace temporal de «${reg.filename}»`, empresa: idDe(reg.empresa), coleccion: datos.c, registroId: reg.id })
  return { data, nombre: reg.filename, mime: reg.mimeType ?? 'application/octet-stream' }
}

/** Los clientes no ven los documentos archivados (azul) en la búsqueda: tampoco en el ZIP ni en el inventario. */
const sinArchivados = (user: User | null) => (esSuperAdmin(user) ? '' : "AND (estado IS NULL OR estado <> 'azul')")

export async function zipDocumentos(req: Ctx, ids: (string | number)[], conHistorico = false) {
  if (!ids.length) throw new AppError('No ha elegido ningún documento.', 400)
  if (ids.length > 500) throw new AppError('Como máximo 500 documentos por descarga.', 400)
  const lista = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).join(',') || '0'
  const docs = await listarDocumentos(req.user, `AND id IN (${lista}) ${sinArchivados(req.user)}`, [], 500)
  const zip = new JSZip()
  let n = 0
  for (const d of docs) {
    const archivos = (await archivosDeDocumento(d.id, req.user)).filter((a) => conHistorico || !a.historico)
    const carpeta = `${seguro((d.empresa as Empresa).razonSocial)}/${seguro((d.categoria as Categoria)?.nombre ?? 'Sin instalación')}/${seguro(d.titulo)}`
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
  const docs = await listarDocumentos(req.user, `AND empresa_id = $1 ${sinArchivados(req.user)} ORDER BY fecha_caducidad`, [Number(empresa.id)], 10000)
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
      { header: 'Instalación', key: 'categoria', width: 22 },
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
      { titulo: 'Instalación', ancho: 100 },
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
