import type { Metadata } from 'next'
import { PaginaLegal } from '@/components/web/PaginaLegal'

export const metadata: Metadata = { title: 'Política de cookies', alternates: { canonical: '/cookies' } }

export default function Cookies() {
  return <PaginaLegal pagina="cookies" titulo="Política de cookies" />
}
