import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import postgres from 'postgres'
import { urlPostgres } from './baseDatos'
import { cerrarApiPublica } from './cerrarApi'
import { asegurarSqlite } from './sqliteLocal'

const cruda = urlPostgres(process.env.DATABASE_URL || 'file:./cmc.db')

/** Producción habla con el Postgres de Supabase. En local, sin DATABASE_URL, sigue el SQLite `cmc.db`. */
export const esPostgres = /^postgres(ql)?:\/\//.test(cruda)

type Fila = Record<string, unknown>

let pg: ReturnType<typeof postgres> | undefined
let cierre: Promise<void> | undefined
let lite: DatabaseSync | undefined

const TOPE_MS = 10_000

function clientePostgres() {
  if (!pg) {
    const opciones = {
      prepare: false,
      // El pooler en modo transacción se queda mudo si se encadenan consultas o se pide el catálogo de tipos.
      fetch_types: false,
      max: 1,
      max_pipeline: 0,
      idle_timeout: 2,
      connect_timeout: 8,
      connection: { statement_timeout: 8000 },
      ssl: (process.env.DATABASE_SSL === 'false' ? false : 'require') as false | 'require',
      types: {
        numeric: {
          to: 1700,
          from: [1700],
          serialize: (x: number | string) => String(x),
          parse: (x: string) => Number(x),
        },
      },
    }
    pg = postgres(cruda, opciones)
    const cliente = pg
    cierre = cerrarApiPublica(cliente).catch((error) => {
      console.error('No se pudo cerrar la API pública de la base de datos.', error)
    })
  }
  return pg
}

async function apiCerrada() {
  if (cierre) await cierre
}

function soltar() {
  const actual = pg
  pg = undefined
  cierre = undefined
  if (!actual) return Promise.resolve()
  return actual.end({ timeout: 0 }).catch(() => undefined)
}

/** Si el pooler acepta la conexión y no contesta, la petición no puede esperar al corte de Vercel. */
async function consultar<T>(consulta: Promise<T>): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined
  const tope = new Promise<never>((_, reject) => {
    reloj = setTimeout(() => reject(new Error('La base de datos no respondió a tiempo.')), TOPE_MS)
  })
  try {
    return await Promise.race([consulta, tope])
  } catch (error) {
    if (error instanceof Error && error.message === 'La base de datos no respondió a tiempo.') {
      consulta.catch(() => undefined)
      await soltar()
    }
    throw error
  } finally {
    if (reloj) clearTimeout(reloj)
  }
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

/** Con CMC_TRAZA_SQL=1 se escribe cada consulta y su duración: sirve para medir cuántas hace cada página. */
const traza = process.env.CMC_TRAZA_SQL === '1'

export async function filas<T = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!traza) return filasSinTraza<T>(sql, params)
  const t0 = performance.now()
  try {
    return await filasSinTraza<T>(sql, params)
  } finally {
    console.info(`[sql] ${(performance.now() - t0).toFixed(1)}ms ${sql.replace(/\s+/g, ' ').slice(0, 110)}`)
  }
}

async function filasSinTraza<T = Fila>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (esPostgres) {
    const cliente = clientePostgres()
    await apiCerrada()
    const rows = await consultar(cliente.unsafe(sql, params as never[]))
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
    const cliente = clientePostgres()
    await apiCerrada()
    await consultar(cliente.unsafe(sql, params as never[]))
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
