'use client'

import { Enlace as Link } from '@/components/Enlace'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { LogoutButton } from './LogoutButton'
import { Icon, type IconName } from './Icon'

type Enlace = { href: string; texto: string; icono: IconName }

/** Nombre y rol. Al pulsarlo salen las opciones del perfil y cerrar sesión. */
export function PerfilPortal({ nombre, rol, enlaces }: { nombre: string; rol: string; enlaces: Enlace[] }) {
  const ruta = usePathname()
  const caja = useRef<HTMLDivElement>(null)
  // Se recuerda en qué página se abrió: al navegar a otra, el menú se cierra solo.
  const [abiertoEn, setAbiertoEn] = useState<string | null>(null)
  const abierto = abiertoEn === ruta
  const setAbierto = (v: boolean | ((a: boolean) => boolean)) => setAbiertoEn((typeof v === 'function' ? v(abierto) : v) ? ruta : null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  return (
    <div className="perfil" ref={caja}>
      {abierto && (
        <div className="perfil__menu side-nav" role="menu">
          {enlaces.map((e) => (
            <Link key={e.href} href={e.href} role="menuitem" aria-current={ruta.startsWith(e.href) ? 'page' : undefined}>
              <Icon name={e.icono} />
              <span style={{ flex: 1 }}>{e.texto}</span>
            </Link>
          ))}
          <LogoutButton />
        </div>
      )}
      <button type="button" className="perfil__boton" aria-expanded={abierto} aria-haspopup="menu" onClick={() => setAbierto((v) => !v)}>
        <span className="small"><strong>{nombre}</strong><br /><span className="muted">{rol}</span></span>
        <Icon name="arrow" />
      </button>
    </div>
  )
}
