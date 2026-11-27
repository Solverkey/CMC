'use client'
import { Enlace as Link } from '@/components/Enlace'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Icon, type IconName } from './Icon'

export type Enlace = { href: string; texto: string; icono: IconName; externo?: boolean; aviso?: number }

export function NavPortal({ enlaces, obligar2FA }: { enlaces: Enlace[]; obligar2FA?: boolean }) {
  const ruta = usePathname()
  const router = useRouter()
  useEffect(() => {
    if (obligar2FA && ruta !== '/portal/seguridad') router.replace('/portal/seguridad')
  }, [obligar2FA, ruta, router])

  return (
    <nav className="side-nav" aria-label="Portal">
      {enlaces.map((e) => {
        const activo = e.href === '/portal' ? ruta === '/portal' : ruta.startsWith(e.href)
        const contenido = (
          <>
            <Icon name={e.icono} />
            <span style={{ flex: 1 }}>{e.texto}</span>
            {Boolean(e.aviso) && <span className="contador">{e.aviso}</span>}
          </>
        )
        return e.externo ? (
          <a key={e.href} href={e.href}>{contenido}</a>
        ) : (
          <Link key={e.href} href={e.href} aria-current={activo ? 'page' : undefined}>{contenido}</Link>
        )
      })}
    </nav>
  )
}
