import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import postgres from 'postgres'
import { urlPostgres } from './baseDatos'
import { asegurarSqlite } from './sqliteLocal'

const cruda = urlPostgres(process.env.DATABASE_URL || 'file:./cmc.db')

/** Producción habla con el Postgres de Supabase. En local, sin DATABASE_URL, sigue el SQLite `cmc.db`. */
export const esPostgres = /^postgres(ql)?:\/\//.test(cruda)

type Fila = Record<string, unknown>

let pg: ReturnType<typeof postgres> | undefined
let lite: DatabaseSync | undefined

function clientePostgres() {
  if (!pg) {
    pg = postgres(cruda, {
      prepare: false,
      max: 3,
      idle_timeout: 5,
      connect_timeout: 10,
      ssl: process.env.DATABASE_SSL === 'false' ? false : 'require',
      types: {
        numeric: {
          to: 1700,
          from: [1700],
          serialize: (x: number | string) => String(x),
          parse: (x: string) => Number(x),
        },
      },
    })
  }
  return pg
}

function clienteSqlite() {
  if (!lite) {
    asegurarSqlite(cruda)
    lite = new DatabaseSync(path.resolve(cruda.slice('file:'.length)))
  }
  return lite
}

/** SQLite solo entiende `?` en el orden en que aparecen. `$1` al final de un UPDATE sigue siendo el primer parámetro. */
function preparar(sql: string, params: unknown[]) {
  if (esPostgres) return { sql, params }
  const ordered: unknown[] = []
  const lite = sql.replace(/\$(\d+)/g, (_m, n) => {
    const v = params[Number(n) - 1]
    ordered.push(v === undefined ? null : v)
    return '?'
  })
  return { sql: lite, params: ordered }
}

const valor = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? Number(v) : v)

const fila = (row: Fila): Fila => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, valor(v)]))

export async function filas<T = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (esPostgres) {
    const rows = await clientePostgres().unsafe(sql, params as never[])
    return (rows as unknown as Fila[]).map((r) => fila(r) as T)
  }
  const q = preparar(sql, params)
  const rows = clienteSqlite().prepare(q.sql).all(...(q.params as (string | number | bigint | null | Uint8Array)[])) as Fila[]
  return rows.map((r) => fila(r) as T)
}

export async function uno<T = Fila>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await filas<T>(sql, params)
  return rows[0]
}

export async function ejecutar(sql: string, params: unknown[] = []): Promise<void> {
  if (esPostgres) {
    await clientePostgres().unsafe(sql, params as never[])
    return
  }
  const q = preparar(sql, params)
  clienteSqlite().prepare(q.sql).run(...(q.params as (string | number | bigint | null | Uint8Array)[]))
}

/** Booleano que Postgres y SQLite aceptan al escribir. */
export const bit = (v: boolean | null | undefined) => (v == null ? null : esPostgres ? v : v ? 1 : 0)

/** Lectura de un booleano venga de Postgres o de SQLite. */
export const bool = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true'

export const ahora = () => new Date().toISOString()

export const num = (v: unknown) => (v == null || v === '' ? null : Number(v))

export const jsonValor = (v: unknown) => {
  if (v == null) return null
  if (typeof v === 'string') {
    try {
      return JSON.parse(v)
    } catch {
      return null
    }
  }
  return v
}

/** Placeholder de un JSON: en Postgres se castea a jsonb. */
export const jsonSql = (n: number) => (esPostgres ? `$${n}::jsonb` : `$${n}`)

export const jsonParam = (v: unknown) => (esPostgres ? v : JSON.stringify(v ?? null))
