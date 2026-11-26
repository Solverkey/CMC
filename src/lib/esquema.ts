import { readFileSync } from 'fs'
import path from 'path'
import { ejecutar, esPostgres, uno } from './db'

/**
 * Creación del esquema en una base vacía (npm run seed). La fuente es src/esquema/postgres.sql;
 * para el SQLite local se traduce aquí. Nunca toca una base que ya tenga tablas.
 */

const ARCHIVO = path.resolve(process.cwd(), 'src/esquema/postgres.sql')

/** Parte el SQL en sentencias respetando las cadenas entre comillas (los textos de las plantillas llevan «;»). */
export function sentencias(sql: string): string[] {
  const salida: string[] = []
  let actual = ''
  let enCadena = false
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    if (!enCadena && c === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i++
      continue
    }
    if (c === "'") {
      if (enCadena && sql[i + 1] === "'") {
        actual += "''"
        i++
        continue
      }
      enCadena = !enCadena
    }
    if (c === ';' && !enCadena) {
      if (actual.trim()) salida.push(actual.trim())
      actual = ''
      continue
    }
    actual += c
  }
  if (actual.trim()) salida.push(actual.trim())
  return salida
}

/** Traduce una sentencia de Postgres a SQLite, o null si en SQLite no hace falta (tipos enumerados, claves ajenas…). */
export function aSqlite(s: string): string | null {
  if (/^(CREATE TYPE|ALTER TYPE|DROP TYPE)\b/i.test(s)) return null
  if (/^ALTER TABLE\s+\S+\s+(ADD CONSTRAINT|ALTER COLUMN|DROP CONSTRAINT|ENABLE|DISABLE)\b/i.test(s)) return null
  return s
    .replace(/"public"\./g, '')
    .replace(/\bserial PRIMARY KEY\b/gi, 'integer PRIMARY KEY')
    .replace(/\btimestamp\(3\) with time zone\b/gi, 'text')
    .replace(/DEFAULT now\(\)/gi, "DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))")
    .replace(/\bjsonb\b/gi, 'text')
    .replace(/\bboolean DEFAULT true\b/gi, 'integer DEFAULT 1')
    .replace(/\bboolean DEFAULT false\b/gi, 'integer DEFAULT 0')
    .replace(/\bboolean\b/gi, 'integer')
    .replace(/"enum_[a-z0-9_]+"/gi, 'text')
    .replace(/::"?[a-z0-9_."]+"?(\[\])?/gi, '')
    .replace(/\s+USING btree\s*/gi, ' ')
    // db.ts ya crea `videos` y `web_rels` al abrir un SQLite (sqliteLocal.ts): no deben chocar.
    .replace(/^CREATE TABLE (?!IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ')
    .replace(/^CREATE (UNIQUE )?INDEX (?!IF NOT EXISTS)/i, 'CREATE $1INDEX IF NOT EXISTS ')
    .replace(/ADD COLUMN IF NOT EXISTS/gi, 'ADD COLUMN')
}

export async function hayEsquema() {
  const fila = esPostgres
    ? await uno<{ n: number }>("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users'")
    : await uno<{ n: number }>("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'users'")
  return Number(fila?.n ?? 0) > 0
}

/** Crea todas las tablas si la base está vacía. Devuelve true si las ha creado. */
export async function crearEsquema() {
  if (await hayEsquema()) return false
  const lista = sentencias(readFileSync(ARCHIVO, 'utf8'))
  for (const s of lista) {
    const sql = esPostgres ? s : aSqlite(s)
    if (sql) await ejecutar(sql)
  }
  return true
}
