import type { Metadata } from 'next'
import { PaginaLegal } from '@/components/web/PaginaLegal'

export const metadata: Metadata = { title: 'Política de privacidad', alternates: { canonical: '/privacidad' } }

export default function Privacidad() {
  return <PaginaLegal pagina="privacidad" titulo="Política de privacidad" />
}
