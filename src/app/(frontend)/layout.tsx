import React from 'react'
import { Jost, Public_Sans } from 'next/font/google'
import './styles.css'

const jost = Jost({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-display' })
const publicSans = Public_Sans({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-sans' })

export const metadata = {
  title: { default: 'CMC · Consultoría de calidad y medio ambiente', template: '%s · CMC' },
  description: 'Implantación ISO 9001 e ISO 14001, estudios de impacto ambiental y gestión documental en Logroño y Burgos.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${jost.variable} ${publicSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
