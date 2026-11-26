/**
 * Dirección pública del portal: enlaces de los correos, descargas temporales, OAuth del servidor MCP, sitemap.
 * 1. NEXT_PUBLIC_SERVER_URL, si se ha configurado (p. ej. un dominio propio).
 * 2. En Vercel, la dirección de producción del proyecto (VERCEL_PROJECT_PRODUCTION_URL), que Vercel pone sola;
 *    en una previsualización, la de ese despliegue (VERCEL_URL).
 * 3. En local, http://localhost:3000.
 */
export function urlServidor() {
  const propia = process.env.NEXT_PUBLIC_SERVER_URL
  if (propia) return propia.replace(/\/$/, '')
  const vercel = process.env.VERCEL_ENV === 'production' ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  return 'http://localhost:3000'
}
