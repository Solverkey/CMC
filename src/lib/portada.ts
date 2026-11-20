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
  const sql = postgres(url, { prepare: false, max: 1, ssl: 'require', connect_timeout: 3 })
  try {
    const rows = await sql<{ name: string }[]>`select name from storage.objects where bucket_id = 'portada' and name ~* '\\.(mp4|webm)$' order by name`
    const urls = rows.map((r) => PUBLICOS + r.name.split('/').map(encodeURIComponent).join('/'))
    cache = { en: Date.now(), urls }
    return urls
  } catch {
    return cache?.urls ?? []
  } finally {
    await sql.end({ timeout: 1 }).catch(() => undefined)
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
