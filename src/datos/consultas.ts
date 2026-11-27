import { cache } from 'react'
import { empresasDe, esSuperAdmin } from '@/access'
import type { Archivo, Categoria, Documento, Empresa, Envio, Hilo, Mensaje, User } from './tipos'
import { ahora, ejecutar, esPostgres, filas, uno } from '@/lib/db'
import { urlDe } from '@/lib/ficheros'
import { mapActividad, mapArchivo, mapCategoria, mapCorreo, mapDocumento, mapEmpresa, mapEnvio, mapHilo, mapMensaje, mapUser, visible } from './mapas'

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

async function personas(lista: number[]) {
  const unicos = ids(lista)
  if (!unicos.length) return new Map<number, User>()
  const rows = await filas<Fila>(`SELECT id, nombre, email, rol, recibe_avisos, activo, totp_activo, updated_at, created_at FROM users WHERE id IN (${unicos.join(',')})`)
  return new Map(rows.map((r) => [Number(r.id), mapUser(r)]))
}

async function documentosDe(lista: number[]) {
  const unicos = ids(lista)
  if (!unicos.length) return new Map<number, Documento>()
  const rows = await filas<Fila>(`SELECT * FROM documentos WHERE id IN (${unicos.join(',')})`)
  return new Map(rows.map((r) => [Number(r.id), mapDocumento(r)]))
}

async function completarHilos(hilos: Hilo[]) {
  const [emps, cats, docs, gente] = await Promise.all([
    empresas(hilos.map((h) => Number(h.empresa))),
    categorias(hilos.map((h) => Number(h.categoria))),
    documentosDe(hilos.map((h) => Number(h.documento))),
    personas(hilos.map((h) => Number(h.asignado))),
  ])
  return hilos.map((h) => ({
    ...h,
    empresa: emps.get(Number(h.empresa)) ?? h.empresa,
    categoria: typeof h.categoria === 'number' ? (cats.get(h.categoria) ?? h.categoria) : h.categoria,
    documento: typeof h.documento === 'number' ? (docs.get(h.documento) ?? null) : h.documento,
    asignado: typeof h.asignado === 'number' ? (gente.get(h.asignado) ?? null) : h.asignado,
  }))
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

export const empresaVisible = cache(async function empresaVisible(user: User | null, id: number | string): Promise<Empresa | null> {
  const e = await empresaPorId(id)
  if (!e || !user) return null
  if (esSuperAdmin(user)) return e
  if (e.activa === false) return null
  return empresasDe(user).map(String).includes(String(e.id)) ? e : null
})

export const empresaPorId = cache(async function empresaPorId(id: number | string) {
  const mapa = await empresas([Number(id)])
  return mapa.get(Number(id)) ?? null
})

export const categoriaPorId = cache(async function categoriaPorId(id: number | string) {
  const row = await uno<Fila>('SELECT * FROM categorias WHERE id = $1', [Number(id)])
  return row ? mapCategoria(row) : null
})

async function conUrls<T extends { filename?: string | null; url?: string | null }>(coleccion: string, items: T[]) {
  await Promise.all(
    items.map(async (it) => {
      if (it.filename) it.url = await urlDe(coleccion, it.filename)
    }),
  )
  return items
}

export const documentoPorId = cache(async function documentoPorId(id: number | string, user?: User | null): Promise<Documento | null> {
  const filtro = user ? `AND ${visible(user, 'empresa_id')}` : ''
  const row = await uno<Fila>(`SELECT * FROM documentos WHERE id = $1 ${filtro}`, [Number(id)])
  if (!row) return null
  const [doc] = await hidratarDocumentos([mapDocumento(row)])
  return doc
})

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
  return completarHilos(rows.map(mapHilo))
}

export const hiloPorId = cache(async function hiloPorId(id: number | string, user?: User | null): Promise<Hilo | null> {
  const filtro = user ? `AND ${visible(user, 'empresa_id')}` : ''
  const row = await uno<Fila>(`SELECT * FROM hilos WHERE id = $1 ${filtro}`, [Number(id)])
  if (!row) return null
  const [hilo] = await completarHilos([mapHilo(row)])
  return hilo ?? null
})

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
  const autores = await personas(rows.map((r) => Number(r.autor_id)))
  return rows.map((r) => {
    const m = mapMensaje(r)
    m.adjuntos = (porMensaje.get(m.id) ?? []).map((id) => porAdj.get(id) ?? id)
    m.autor = typeof m.autor === 'number' ? (autores.get(m.autor) ?? null) : m.autor
    return m
  }) as Mensaje[]
}

export async function correosDeEmpresa(empresaId: number | string, limite = 50) {
  const rows = await filas<Fila>('SELECT * FROM correos WHERE empresa_id = $1 ORDER BY created_at DESC LIMIT $2', [Number(empresaId), limite])
  return rows.map(mapCorreo)
}

/**
 * Qué parte del registro de actividad ve cada uno. CMC: todo. Administrador de empresa: lo de las empresas que administra
 * y sus propios accesos. Lo que no es de ninguna empresa (accesos de otros, consultas de la web) solo lo ve CMC.
 */
export function filtroActividad(user: User | null) {
  if (!user) return 'TRUE'
  if (esSuperAdmin(user)) return 'TRUE'
  const propios = `(empresa_id IS NULL AND usuario_id = ${Number(user.id)})`
  const admin = empresasDe(user, true).map(Number).filter((n) => Number.isFinite(n))
  if (!admin.length) return propios
  const activa = esPostgres ? 'true' : '1'
  return `((empresa_id IN (${admin.join(',')}) AND EXISTS (SELECT 1 FROM empresas ev WHERE ev.id = empresa_id AND ev.activa = ${activa})) OR ${propios})`
}

export async function listarActividad(user: User | null, sqlExtra: string, params: unknown[] = [], limite = 100, offset = 0) {
  const rows = await filas<Fila>(`SELECT * FROM actividad WHERE ${filtroActividad(user)} ${sqlExtra} ORDER BY created_at DESC LIMIT ${Number(limite)} OFFSET ${Number(offset)}`, params)
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

export type UltimoMensaje = { texto: string; autor: string | null; deCmc: boolean; fecha: string; total: number }

/**
 * Último mensaje y número de mensajes de cada conversación, para la bandeja.
 * Sirve para mostrar el extracto y saber de qué lado está la pelota.
 */
export async function ultimosMensajes(hiloIds: (number | string)[]): Promise<Map<number, UltimoMensaje>> {
  const unicos = ids(hiloIds)
  const mapa = new Map<number, UltimoMensaje>()
  if (!unicos.length) return mapa
  const lista = unicos.join(',')
  const [ultimos, totales] = await Promise.all([
    filas<Fila>(
      `SELECT m.hilo_id, m.texto, m.created_at, u.nombre, u.rol
         FROM mensajes m LEFT JOIN users u ON u.id = m.autor_id
        WHERE m.hilo_id IN (${lista})
          AND m.id = (SELECT m2.id FROM mensajes m2 WHERE m2.hilo_id = m.hilo_id ORDER BY m2.created_at DESC, m2.id DESC LIMIT 1)`,
    ),
    filas<Fila>(`SELECT hilo_id, COUNT(*) AS n FROM mensajes WHERE hilo_id IN (${lista}) GROUP BY hilo_id`),
  ])
  const porHilo = new Map(totales.map((t) => [Number(t.hilo_id), Number(t.n)]))
  for (const r of ultimos) {
    mapa.set(Number(r.hilo_id), {
      texto: String(r.texto ?? ''),
      autor: r.nombre == null ? null : String(r.nombre),
      deCmc: r.rol === 'superadmin',
      fecha: String(r.created_at),
      total: porHilo.get(Number(r.hilo_id)) ?? 0,
    })
  }
  return mapa
}

/**
 * Conversaciones abiertas cuyo último mensaje es del otro lado: para CMC, las que escribió el cliente;
 * para el cliente, las que contestó CMC. Es el contador del menú.
 */
export async function contarPendientesDeRespuesta(user: User) {
  const otroLado = esSuperAdmin(user) ? "COALESCE(u.rol, 'cliente') <> 'superadmin'" : "u.rol = 'superadmin'"
  const row = await uno<{ n: number }>(
    `SELECT COUNT(*) AS n FROM hilos h
      WHERE h.estado = 'abierto' AND ${visible(user, 'h.empresa_id')}
        AND EXISTS (
          SELECT 1 FROM mensajes m LEFT JOIN users u ON u.id = m.autor_id
           WHERE m.hilo_id = h.id AND ${otroLado}
             AND m.id = (SELECT m2.id FROM mensajes m2 WHERE m2.hilo_id = h.id ORDER BY m2.created_at DESC, m2.id DESC LIMIT 1)
        )`,
  )
  return Number(row?.n ?? 0)
}

// ——— Leídos y no leídos de Comunicación ———
// Una fila por persona y conversación con la última vez que la abrió. La fila (0, 0) guarda cuándo se creó la tabla:
// lo escrito antes cuenta como leído, para que al desplegar no aparezca todo el histórico como nuevo.

let lecturasListas: Promise<void> | null = null

export function asegurarLecturas() {
  lecturasListas ??= (async () => {
    const id = esPostgres ? 'serial PRIMARY KEY' : 'integer PRIMARY KEY'
    const fecha = esPostgres ? 'timestamp(3) with time zone' : 'text'
    await ejecutar(`CREATE TABLE IF NOT EXISTS hilos_lecturas (id ${id}, hilo_id integer NOT NULL, usuario_id integer NOT NULL, leido_en ${fecha} NOT NULL)`)
    await ejecutar('CREATE UNIQUE INDEX IF NOT EXISTS hilos_lecturas_hilo_usuario_idx ON hilos_lecturas (hilo_id, usuario_id)')
    await ejecutar('INSERT INTO hilos_lecturas (hilo_id, usuario_id, leido_en) VALUES (0, 0, $1) ON CONFLICT (hilo_id, usuario_id) DO NOTHING', [ahora()])
  })().catch((e) => {
    lecturasListas = null
    throw e
  })
  return lecturasListas
}

/** Marca la conversación como leída por el usuario hasta este momento. */
export async function marcarLeido(hiloId: number | string, usuarioId: number | string) {
  await asegurarLecturas()
  await ejecutar(
    'INSERT INTO hilos_lecturas (hilo_id, usuario_id, leido_en) VALUES ($1, $2, $3) ON CONFLICT (hilo_id, usuario_id) DO UPDATE SET leido_en = excluded.leido_en',
    [Number(hiloId), Number(usuarioId), ahora()],
  )
}

const condicionNoLeido = `(m.autor_id IS NULL OR m.autor_id <> $1)
  AND m.created_at > COALESCE(
    (SELECT l.leido_en FROM hilos_lecturas l WHERE l.hilo_id = m.hilo_id AND l.usuario_id = $1),
    (SELECT b.leido_en FROM hilos_lecturas b WHERE b.hilo_id = 0 AND b.usuario_id = 0)
  )`

/** Mensajes sin leer (escritos por otros después de la última lectura) de cada conversación. */
export async function noLeidos(usuarioId: number | string, hiloIds: (number | string)[]): Promise<Map<number, number>> {
  const unicos = ids(hiloIds)
  if (!unicos.length) return new Map()
  await asegurarLecturas()
  const rows = await filas<Fila>(`SELECT m.hilo_id, COUNT(*) AS n FROM mensajes m WHERE m.hilo_id IN (${unicos.join(',')}) AND ${condicionNoLeido} GROUP BY m.hilo_id`, [Number(usuarioId)])
  return new Map(rows.map((r) => [Number(r.hilo_id), Number(r.n)]))
}

/** Conversaciones con mensajes sin leer: el contador del menú. */
export async function contarNoLeidas(user: User) {
  await asegurarLecturas()
  const row = await uno<{ n: number }>(
    `SELECT COUNT(DISTINCT m.hilo_id) AS n FROM mensajes m JOIN hilos h ON h.id = m.hilo_id
      WHERE ${visible(user, 'h.empresa_id')} AND ${condicionNoLeido}`,
    [Number(user.id)],
  )
  return Number(row?.n ?? 0)
}
