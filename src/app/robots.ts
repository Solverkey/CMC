import { urlServidor } from '@/lib/url'
import type { MetadataRoute } from 'next'

const base = urlServidor()

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/portal', '/admin', '/api', '/.well-known'] },
    sitemap: `${base}/sitemap.xml`,
  }
}
