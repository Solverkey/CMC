'use client'

import { useEffect } from 'react'

/** Safari deja el calendario abierto después de elegir el día. Al soltar el foco se cierra. */
export function CerrarCalendario() {
  useEffect(() => {
    const cerrar = (e: Event) => {
      const el = e.target
      if (!(el instanceof HTMLInputElement) || el.type !== 'date') return
      requestAnimationFrame(() => el.blur())
    }
    document.addEventListener('change', cerrar)
    return () => document.removeEventListener('change', cerrar)
  }, [])
  return null
}
