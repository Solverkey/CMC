import fs from 'fs/promises'
import path from 'path'
import { sql } from '@payloadcms/db-sqlite'
import type { Payload } from 'payload'

type SQL = ReturnType<typeof sql>

/** Consultas agregadas directas a la base de datos (SQLite o Postgres), para el panel con miles de documentos. */
async function filas<T>(payload: Payload, q: SQL): Promise<T[]> {
  const db = payload.db as unknown as { name: string; drizzle: { execute?: (q: SQL) => Promise<{ rows: T[] }>; all?: (q: SQL) => Promise<T[]> } }
  if (db.name === 'postgres') return (await db.drizzle.execute!(q)).rows
  return db.drizzle.all!(q)
}

export type ConteoEstados = Record<string, { verde: number; amarillo: number; naranja: number; rojo: number; azul: number; negro: number }>

/** Documentos por empresa y estado. `empresas` = null para todas (solo CMC). */
export async function conteoPorEmpresa(payload: Payload, empresas: (number | string)[] | null): Promise<ConteoEstados> {
  if (empresas && !empresas.length) return {}
  const filtro = empresas ? sql`WHERE empresa_id IN (${sql.join(empresas.map((e) => sql`${Number(e)}`), sql`, `)})` : sql``
  const rows = await filas<{ empresa: number | string; estado: string; n: number | string }>(payload, sql`SELECT empresa_id AS empresa, estado, COUNT(*) AS n FROM documentos ${filtro} GROUP BY empresa_id, estado`)
  const out: ConteoEstados = {}
  for (const r of rows) {
    const k = String(r.empresa)
    out[k] ??= { verde: 0, amarillo: 0, naranja: 0, rojo: 0, azul: 0, negro: 0 }
    if (r.estado in out[k]) out[k][r.estado as keyof ConteoEstados[string]] = Number(r.n)
  }
  return out
}

const TABLAS_FICHEROS = ['archivos', 'envios', 'adjuntos', 'originales'] as const

/** Almacenamiento consumido (RF-23): ficheros por empresa, logotipos y base de datos. */
export async function almacenamiento(payload: Payload) {
  const porEmpresa: Record<string, number> = {}
  let ficheros = 0
  for (const t of TABLAS_FICHEROS) {
    const rows = await filas<{ empresa: number | string | null; total: number | string | null }>(payload, sql`SELECT empresa_id AS empresa, SUM(filesize) AS total FROM ${sql.identifier(t)} GROUP BY empresa_id`)
    for (const r of rows) {
      const n = Number(r.total ?? 0)
      ficheros += n
      if (r.empresa != null) porEmpresa[String(r.empresa)] = (porEmpresa[String(r.empresa)] ?? 0) + n
    }
  }
  const [media] = await filas<{ total: number | string | null }>(payload, sql`SELECT SUM(filesize) AS total FROM media`)
  ficheros += Number(media?.total ?? 0)

  let bd = 0
  if ((payload.db as unknown as { name: string }).name === 'postgres') {
    const [r] = await filas<{ n: number | string }>(payload, sql`SELECT pg_database_size(current_database()) AS n`)
    bd = Number(r?.n ?? 0)
  } else {
    const url = process.env.DATABASE_URL ?? ''
    if (url.startsWith('file:')) bd = await fs.stat(path.resolve(url.slice(5))).then((s) => s.size).catch(() => 0)
  }
  return { total: ficheros + bd, ficheros, bd, porEmpresa }
}
