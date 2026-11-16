import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: 'Portal documental · CMC', template: '%s · Portal documental CMC' },
  description: 'Portal documental de CMC: documentación ISO, OCA, licencias y proyectos con control de caducidades.',
  robots: { index: false, follow: false },
}

export default function PortalRaiz({ children }: { children: React.ReactNode }) {
  return children
}
