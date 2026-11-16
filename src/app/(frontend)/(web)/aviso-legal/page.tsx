import type { Metadata } from 'next'
import { PaginaLegal } from '@/components/web/PaginaLegal'

export const metadata: Metadata = { title: 'Aviso legal', alternates: { canonical: '/aviso-legal' } }

export default function AvisoLegal() {
  return <PaginaLegal pagina="avisoLegal" titulo="Aviso legal" />
}
