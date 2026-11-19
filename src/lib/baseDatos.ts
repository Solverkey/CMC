const POOLER = 'aws-1-eu-west-1.pooler.supabase.com'

/**
 * El host `db.<ref>.supabase.co` solo tiene IPv6. Vercel sale por IPv4 y la página no llega a enviarse.
 * El pooler de sesión es IPv4. El puerto 6543 es el modo transacción y rompe las migraciones de Payload.
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
  if (url.port !== '5432') url.port = '5432'
  url.searchParams.delete('pgbouncer')
  return url.toString()
}
