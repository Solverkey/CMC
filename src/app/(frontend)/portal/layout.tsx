import type { Metadata } from 'next'

// El portal lee la base de datos con la sesión. No se genera durante el build de Vercel.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { default: 'Portal documental · CMC', template: '%s · Portal documental CMC' },
  description: 'Portal documental de CMC: documentación ISO, OCA, licencias y proyectos con control de caducidades.',
  robots: { index: false, follow: false },
}

export default function PortalRaiz({ children }: { children: React.ReactNode }) {
  return children
}
