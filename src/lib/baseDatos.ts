const POOLER = 'aws-1-eu-west-1.pooler.supabase.com'

/**
 * El host `db.<ref>.supabase.co` solo tiene IPv6 y Vercel sale por IPv4: se usa el pooler.
 * El modo transacción (6543) pierde la respuesta de postgres.js y la página se queda en blanco.
 * El modo sesión (5432) contesta. Cada función usa una conexión y la suelta enseguida.
 */
export function urlPostgres(raw: string) {
  if (!/^postgres(ql)?:\/\//.test(raw)) return raw
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return raw
  }
  const directo = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
  const pooler = url.hostname.endsWith('.pooler.supabase.com')
  if (!directo && !pooler) return raw
  if (directo) {
    const ref = directo[1]
    const usuario = decodeURIComponent(url.username)
    if (!usuario.includes('.')) url.username = `${usuario}.${ref}`
    url.hostname = POOLER
  }
  url.port = '5432'
  url.searchParams.delete('pgbouncer')
  return url.toString()
}
