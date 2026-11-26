'use client'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Icon } from './Icon'

/** En el móvil el menú del portal se pliega tras un botón para que el contenido quede arriba. En escritorio siempre se ve. */
export function MenuPortal({ children }: { children: React.ReactNode }) {
  const ruta = usePathname()
  // Se recuerda en qué página se abrió: al navegar a otra, el menú se cierra solo.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null)
  const abierto = abiertoEn === ruta
  return (
    <>
      <button type="button" className="btn btn--secondary btn--sm portal__abrir" aria-expanded={abierto} aria-controls="menu-portal" onClick={() => setAbiertoEn(abierto ? null : ruta)}>
        <Icon name={abierto ? 'close' : 'list'} />Menú
      </button>
      <div id="menu-portal" className={`portal__menu${abierto ? ' portal__menu--abierto' : ''}`}>{children}</div>
    </>
  )
}
