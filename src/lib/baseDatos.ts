const POOLER = 'aws-1-eu-west-1.pooler.supabase.com'

/**
 * El host `db.<ref>.supabase.co` solo tiene IPv6 y Vercel sale por IPv4: se usa el pooler.
 * El modo sesión (5432) admite 15 clientes en total y las instancias de Vercel lo agotan.
 * El modo transacción (6543) reparte las conexiones por consulta y no se llena.
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
  url.port = '6543'
  url.searchParams.delete('pgbouncer')
  return url.toString()
}
