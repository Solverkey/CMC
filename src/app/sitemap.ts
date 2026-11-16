import type { MetadataRoute } from 'next'

const base = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  const rutas: [string, number][] = [
    ['/', 1],
    ['/servicios', 0.9],
    ['/trabajos', 0.7],
    ['/quienes-somos', 0.7],
    ['/contacto', 0.8],
    ['/aviso-legal', 0.1],
    ['/privacidad', 0.1],
    ['/cookies', 0.1],
  ]
  return rutas.map(([ruta, priority]) => ({ url: `${base}${ruta}`, changeFrequency: 'monthly', priority }))
}
