import React from 'react'
import { Jost, Public_Sans } from 'next/font/google'
import './styles.css'

const jost = Jost({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-display' })
const publicSans = Public_Sans({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-sans' })

export const metadata = {
  title: { default: 'Portal documental · CMC', template: '%s · Portal documental CMC' },
  description: 'Portal documental de CMC: documentación ISO, OCA, licencias y proyectos con control de caducidades.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${jost.variable} ${publicSans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
