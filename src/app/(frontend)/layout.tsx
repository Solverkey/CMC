import type { Metadata } from 'next'
import React from 'react'
import { Jost, Public_Sans } from 'next/font/google'
import './styles.css'

const jost = Jost({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-display' })
const publicSans = Public_Sans({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-sans' })

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'),
  title: { default: 'CMC · Consultoría de calidad y medio ambiente', template: '%s · CMC' },
  description: 'Consultoría de calidad y medio ambiente en Logroño y Burgos: ISO 9001, ISO 14001, estudios de impacto ambiental y gestión documental.',
  openGraph: { type: 'website', locale: 'es_ES', siteName: 'CMC · Consultoría de calidad y medio ambiente' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${jost.variable} ${publicSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
