'use client'

import { useRouter } from 'next/navigation'
import type { KeyboardEvent, ReactNode } from 'react'

/** Fila de tabla que abre su ficha al pulsar en cualquier celda. */
export function FilaEnlace({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter()
  const abrir = () => router.push(href)
  const tecla = (ev: KeyboardEvent<HTMLTableRowElement>) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault()
      abrir()
    }
  }
  return (
    <tr className="fila-enlace" tabIndex={0} onClick={abrir} onKeyDown={tecla}>
      {children}
    </tr>
  )
}
