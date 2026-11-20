import { empresasDe, esSuperAdmin } from '@/access'
import type { Archivo, Categoria, Documento, Empresa, Envio, Hilo, Mensaje, User } from './tipos'
import { filas, uno } from '@/lib/db'
import { urlDe } from '@/lib/ficheros'
import { mapActividad, mapArchivo, mapCategoria, mapCorreo, mapDocumento, mapEmpresa, mapEnvio, mapHilo, mapMensaje, visible } from './mapas'

type Fila = Record<string, unknown>

const ids = (vals: unknown[]) => [...new Set(vals.map(Number).filter((n) => Number.isFinite(n) && n > 0))]

async function empresas(lista: number[]) {
  const unicos = ids(lista)
  if (!unicos.length) return new Map<number, Empresa>()
  const rows = await filas<Fila>(`SELECT * FROM empresas WHERE id IN (${unicos.join(',')})`)
  const avisos = await filas<Fila>(`SELECT _parent_id AS padre, id, email FROM empresas_emails_aviso WHERE _parent_id IN (${unicos.join(',')}) ORDER BY _order`)
  const por = new Map<number, { email: string; id: string }[]>()
  for (const a of avisos) {
    const l = por.get(Number(a.padre)) ?? []
    l.push({ email: String(a.email), id: String(a.id) })
    por.set(Number(a.padre), l)
  }
  return new Map(rows.map((r) => [Number(r.id), mapEmpresa(r, por.get(Number(r.id)) ?? [])]))
}

async function categorias(lista: number[]) {
  const unicos = ids(lista)
  if (!unicos.length) return new Map<number, Categoria>()
  const rows = await filas<Fila>(`SELECT * FROM categorias WHERE id IN (${unicos.join(',')})`)
  return new Map(rows.map((r) => [Number(r.id), mapCategoria(r)]))
}

async function efectosArchivo(lista: number[]) {
  const unicos = ids(lista)
  const mapa = new Map<number, Archivo['efectos']>()
  if (!unicos.length) return mapa
  const rows = await filas<Fila>(`SELECT parent_id, value FROM archivos_efectos WHERE parent_id IN (${unicos.join(',')}) ORDER BY "order"`)
  for (const r of rows) {
    const l = mapa.get(Number(r.parent_id)) ?? []
    l!.push(r.value as NonNullable<Archivo['efectos']>[number])
    mapa.set(Number(r.parent_id), l)
  }
  return mapa
}

export async function empresaVisible(user: User | null, id: number | string): Promise<Empresa | null> {
  const e = await empresaPorId(id)
  if (!e || !user) return null
  if (esSuperAdmin(user)) return e
  if (e.activa === false) return null
  return empresasDe(user).map(String).includes(String(e.id)) ? e : null
}

export async function empresaPorId(id: number | string) {
  const mapa = await empresas([Number(id)])
  return mapa.get(Number(id)) ?? null
}

export async function categoriaPorId(id: number | string) {
  const row = await uno<Fila>('SELECT * FROM categorias WHERE id = $1', [Number(id)])
  return row ? mapCategoria(row) : null
}

async function conUrls<T extends { filename?: string | null; url?: string | null }>(coleccion: string, items: T[]) {
  await Promise.all(
    items.map(async (it) => {
      if (it.filename) it.url = await urlDe(coleccion, it.filename)
    }),
  )
  return items
}

export async function documentoPorId(id: number | string, user?: User | null): Promise<Documento | null> {
  const filtro = user ? `AND ${visible(user, 'empresa_id')}` : ''
  const row = await uno<Fila>(`SELECT * FROM documentos WHERE id = $1 ${filtro}`, [Number(id)])
  if (!row) return null
  const [doc] = await hidratarDocumentos([mapDocumento(row)])
  return doc
}

export async function hidratarDocumentos(docs: Documento[]) {
  const emps = await empresas(docs.map((d) => Number(d.empresa)))
  const cats = await categorias(docs.map((d) => Number(d.categoria)))
  return docs.map((d) => ({ ...d, empresa: emps.get(Number(d.empresa)) ?? d.empresa, categoria: cats.get(Number(d.categoria)) ?? d.categoria }))
}

export async function listarDocumentos(user: User | null, sqlExtra: string, params: unknown[] = [], limite = 500) {
  const rows = await filas<Fila>(`SELECT * FROM documentos WHERE ${visible(user, 'empresa_id')} ${sqlExtra} LIMIT ${Number(limite)}`, params)
  return hidratarDocumentos(rows.map(mapDocumento))
}

export async function archivosDeDocumento(documentoId: number | string, user?: User | null) {
  const filtro = user ? `AND ${visible(user, 'empresa_id')}` : ''
  const rows = await filas<Fila>(`SELECT * FROM archivos WHERE documento_id = $1 ${filtro} ORDER BY created_at DESC`, [Number(documentoId)])
  const ef = await efectosArchivo(rows.map((r) => Number(r.id)))
  return conUrls('archivos', rows.map((r) => mapArchivo(r, ef.get(Number(r.id)) ?? [])))
}

export async function archivoPorId(id: number | string, user?: User | null) {
  const filtro = user ? `AND ${visible(user, 'empresa_id')}` : ''
  const row = await uno<Fila>(`SELECT * FROM archivos WHERE id = $1 ${filtro}`, [Number(id)])
  if (!row) return null
  const ef = await efectosArchivo([Number(row.id)])
  const [a] = await conUrls('archivos', [mapArchivo(row, ef.get(Number(row.id)) ?? [])])
  return a
}

export async function envioPorId(id: number | string, user?: User | null) {
  const filtro = user ? `AND ${visible(user, 'empresa_id')}` : ''
  const row = await uno<Fila>(`SELECT * FROM envios WHERE id = $1 ${filtro}`, [Number(id)])
  if (!row) return null
  const [e] = await hidratarEnvios([mapEnvio(row)])
  return e
}

export async function hidratarEnvios(lista: Envio[]) {
  const emps = await empresas(lista.map((e) => Number(e.empresa)))
  const con = await conUrls('envios', lista)
  return con.map((e) => ({ ...e, empresa: emps.get(Number(e.empresa)) ?? e.empresa }))
}

export async function listarEnvios(user: User | null, sqlExtra: string, params: unknown[] = [], limite = 200) {
  const rows = await filas<Fila>(`SELECT * FROM envios WHERE ${visible(user, 'empresa_id')} ${sqlExtra} LIMIT ${Number(limite)}`, params)
  return hidratarEnvios(rows.map(mapEnvio))
}

export async function categoriasDeEmpresa(empresaId: number | string, { archivadas = true } = {}) {
  const extra = archivadas ? '' : ' AND (archivada IS NULL OR archivada IS NOT TRUE)'
  const rows = await filas<Fila>(`SELECT * FROM categorias WHERE empresa_id = $1${extra} ORDER BY orden, nombre`, [Number(empresaId)])
  return rows.map(mapCategoria)
}

export async function listarHilos(user: User | null, sqlExtra: string, params: unknown[] = []) {
  const rows = await filas<Fila>(`SELECT * FROM hilos WHERE ${visible(user, 'empresa_id')} ${sqlExtra}`, params)
  const emps = await empresas(rows.map((r) => Number(r.empresa_id)))
  return rows.map((r) => {
    const h = mapHilo(r)
    return { ...h, empresa: emps.get(Number(h.empresa)) ?? h.empresa }
  })
}

export async function hiloPorId(id: number | string, user?: User | null): Promise<Hilo | null> {
  const filtro = user ? `AND ${visible(user, 'empresa_id')}` : ''
  const row = await uno<Fila>(`SELECT * FROM hilos WHERE id = $1 ${filtro}`, [Number(id)])
  if (!row) return null
  const emps = await empresas([Number(row.empresa_id)])
  const h = mapHilo(row)
  return { ...h, empresa: emps.get(Number(h.empresa)) ?? h.empresa }
}

export async function mensajesDeHilo(hiloId: number | string) {
  const rows = await filas<Fila>('SELECT * FROM mensajes WHERE hilo_id = $1 ORDER BY created_at', [Number(hiloId)])
  const rels = rows.length
    ? await filas<Fila>(`SELECT parent_id, adjuntos_id FROM mensajes_rels WHERE parent_id IN (${rows.map((r) => Number(r.id)).join(',')}) AND path = 'adjuntos' ORDER BY "order"`)
    : []
  const adjIds = ids(rels.map((r) => r.adjuntos_id))
  const adjRows = adjIds.length ? await filas<Fila>(`SELECT * FROM adjuntos WHERE id IN (${adjIds.join(',')})`) : []
  const { mapAdjunto } = await import('./mapas')
  const adj = await conUrls('adjuntos', adjRows.map(mapAdjunto))
  const porAdj = new Map(adj.map((a) => [a.id, a]))
  const porMensaje = new Map<number, number[]>()
  for (const r of rels) {
    const l = porMensaje.get(Number(r.parent_id)) ?? []
    l.push(Number(r.adjuntos_id))
    porMensaje.set(Number(r.parent_id), l)
  }
  return rows.map((r) => {
    const m = mapMensaje(r)
    m.adjuntos = (porMensaje.get(m.id) ?? []).map((id) => porAdj.get(id) ?? id)
    return m
  }) as Mensaje[]
}

export async function correosDeEmpresa(empresaId: number | string, limite = 50) {
  const rows = await filas<Fila>('SELECT * FROM correos WHERE empresa_id = $1 ORDER BY created_at DESC LIMIT $2', [Number(empresaId), limite])
  return rows.map(mapCorreo)
}

export async function listarActividad(user: User | null, sqlExtra: string, params: unknown[] = [], limite = 100, offset = 0) {
  const filtro = user ? visible(user, 'empresa_id') : 'TRUE'
  const rows = await filas<Fila>(`SELECT * FROM actividad WHERE (${filtro} OR empresa_id IS NULL) ${sqlExtra} ORDER BY created_at DESC LIMIT ${Number(limite)} OFFSET ${Number(offset)}`, params)
  return rows.map(mapActividad)
}

export async function contar(tabla: string, where: string, params: unknown[] = []) {
  const row = await uno<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabla} WHERE ${where}`, params)
  return Number(row?.n ?? 0)
}

export async function usuariosCms() {
  const rows = await filas<Fila>(`SELECT id, nombre, email, rol FROM users WHERE rol = 'superadmin' AND (activo IS NULL OR activo IS NOT FALSE) ORDER BY nombre`)
  return rows.map((r) => ({ id: Number(r.id), nombre: String(r.nombre), email: String(r.email) }))
}
