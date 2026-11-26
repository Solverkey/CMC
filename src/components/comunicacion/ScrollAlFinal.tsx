'use client'
import { useEffect, useRef } from 'react'

/** Lleva la conversación al último mensaje al abrirla y cuando llega uno nuevo. */
export function ScrollAlFinal({ marca }: { marca: string | number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const caja = ref.current?.parentElement
    if (caja) caja.scrollTop = caja.scrollHeight
  }, [marca])
  return <span ref={ref} aria-hidden="true" />
}
