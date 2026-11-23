/** Si la ficha trae una dirección de otro host, el archivo se pide al sitio que está abierto. */
export function urlDelSitio(url: string) {
  if (typeof window === 'undefined') return url
  try {
    const destino = new URL(url, window.location.href)
    if (!destino.pathname.startsWith('/api/ficheros/')) return url
    return `${destino.pathname}${destino.search}`
  } catch {
    return url
  }
}
