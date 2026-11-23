import fs from 'fs'
import path from 'path'
import postgres from 'postgres'
import { urlPostgres } from '@/lib/baseDatos'

const PUBLICOS = 'https://adfunvjmuqjkscarwvlu.supabase.co/storage/v1/object/public/portada/'
let cache: { en: number; urls: string[] } | null = null

/** Vídeos del bucket público `portada`. Si la base no responde, la portada sigue con el resto. */
export async function videosRemotos(): Promise<string[]> {
  const url = process.env.SUPABASE_DB_URL ? urlPostgres(process.env.SUPABASE_DB_URL) : ''
  if (!url.startsWith('postgres')) return []
  if (cache && Date.now() - cache.en < 30_000) return cache.urls
  const opciones = {
    prepare: false,
    fetch_types: false,
    max: 1,
    max_pipeline: 1,
    ssl: 'require' as const,
    connect_timeout: 3,
    connection: { statement_timeout: 2500 },
  }
  const sql = postgres(url, opciones)
  let agotado = false
  const consulta = sql<{ name: string }[]>`select name from storage.objects where bucket_id = 'portada' and name ~* '\\.(mp4|webm)$' order by name`
  const tope = new Promise<never>((_, reject) => setTimeout(() => {
    agotado = true
    reject(new Error('tiempo'))
  }, 3000))
  try {
    const rows = await Promise.race([consulta, tope])
    const urls = rows.map((r) => PUBLICOS + r.name.split('/').map(encodeURIComponent).join('/'))
    cache = { en: Date.now(), urls }
    return urls
  } catch {
    if (agotado) consulta.catch(() => undefined)
    return cache?.urls ?? []
  } finally {
    await sql.end({ timeout: 0 }).catch(() => undefined)
  }
}

/** Mp4 o WebM dejados en public/portada, además de los de la web. */
export function videosSueltos(): string[] {
  const dir = path.join(process.cwd(), 'public', 'portada')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(mp4|webm)$/i.test(f))
    .sort()
    .map((f) => `/portada/${encodeURIComponent(f)}`)
}
