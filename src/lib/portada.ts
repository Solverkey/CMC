import fs from 'fs'
import path from 'path'
import { Client } from 'pg'

const PUBLICOS = 'https://adfunvjmuqjkscarwvlu.supabase.co/storage/v1/object/public/portada/'
let cache: { en: number; urls: string[] } | null = null

/** Vídeos del bucket público `portada` en Supabase. Si no responde, la portada sigue con el resto. */
export async function videosRemotos(): Promise<string[]> {
  const url = process.env.SUPABASE_DB_URL
  if (!url) return []
  if (cache && Date.now() - cache.en < 30_000) return cache.urls
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 2500 })
  try {
    await client.connect()
    await client.query('set statement_timeout = 2500')
    const { rows } = await client.query<{ name: string }>(`select name from storage.objects where bucket_id = 'portada' and name ~* '\\.(mp4|webm)$' order by name`)
    const urls = rows.map((r) => PUBLICOS + r.name.split('/').map(encodeURIComponent).join('/'))
    cache = { en: Date.now(), urls }
    return urls
  } catch {
    return cache?.urls ?? []
  } finally {
    await client.end().catch(() => {})
  }
}

/** Mp4 o WebM dejados en public/portada, además de los subidos en Administración → Web. */
export function videosSueltos(): string[] {
  const dir = path.join(process.cwd(), 'public', 'portada')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(mp4|webm)$/i.test(f))
    .sort()
    .map((f) => `/portada/${encodeURIComponent(f)}`)
}
