'use client'

import Link from 'next/link'
import { useState, type ComponentProps } from 'react'

/**
 * Enlace del portal que precarga solo cuando hay intención (ratón encima, foco o dedo), no por aparecer en pantalla.
 * Las páginas del portal son dinámicas: precargar cada enlace visible lanzaba unas 40 peticiones al servidor por vista.
 * Con la intención basta para que, al hacer clic, el esqueleto de carga ya esté listo.
 */
export function Enlace({ onMouseEnter, onFocus, onTouchStart, ...props }: ComponentProps<typeof Link>) {
  const [activo, setActivo] = useState(false)
  return (
    <Link
      {...props}
      prefetch={activo ? null : false}
      onMouseEnter={(e) => {
        setActivo(true)
        onMouseEnter?.(e)
      }}
      onFocus={(e) => {
        setActivo(true)
        onFocus?.(e)
      }}
      onTouchStart={(e) => {
        setActivo(true)
        onTouchStart?.(e)
      }}
    />
  )
}
