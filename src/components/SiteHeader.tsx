'use client'

import Link from 'next/link'
import { abrirCookies } from './web/AvisoCookies'
import { MenuMovil } from './MenuMovil'
import type { DatosWeb } from '@/lib/web'
import { telefonoHref } from '@/lib/web'

const enlaces = [
  { href: '/servicios', texto: 'Servicios' },
  { href: '/trabajos', texto: 'Trabajos' },
  { href: '/quienes-somos', texto: 'Quiénes somos' },
  { href: '/contacto', texto: 'Contacto' },
]

const Navegacion = ({ etiqueta, className }: { etiqueta: string; className: string }) => (
  <nav className={className} aria-label={etiqueta}>
    {enlaces.map((e) => (
      <Link key={e.href} href={e.href}>
        {e.texto}
      </Link>
    ))}
    <Link href="/portal" className="btn btn--primary btn--sm">
      Acceso clientes
    </Link>
  </nav>
)

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container">
        <Link href="/" className="wordmark" aria-label="CMC, consultoría de calidad y medio ambiente">
          <img src="/marca/cmc.png" alt="" width={408} height={112} />
        </Link>
        <Navegacion etiqueta="Principal" className="nav nav--escritorio" />
        <MenuMovil>
          <Navegacion etiqueta="Principal (móvil)" className="nav nav--movil" />
        </MenuMovil>
      </div>
    </header>
  )
}

export function SiteFooter({ web }: { web: DatosWeb }) {
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div className="stack" style={{ gap: 8 }}>
          <img className="site-footer__marca" src="/marca/cmc-blanco.png" alt="CMC, consultoría de calidad y medio ambiente" width={408} height={112} />
          <span>Desde 2000</span>
          <a href={`mailto:${web.email}`}>{web.email}</a>
        </div>
        {web.sedes.map((s) => (
          <div key={s.ciudad} className="stack" style={{ gap: 4 }}>
            <strong>{s.ciudad}</strong>
            <span>{s.direccion}</span>
            <span>{s.codigoPostal}</span>
            <a href={telefonoHref(s.telefono)}>{s.telefono}</a>
          </div>
        ))}
        <nav aria-label="Pie" className="stack" style={{ gap: 4 }}>
          {enlaces.map((e) => (
            <Link key={e.href} href={e.href}>
              {e.texto}
            </Link>
          ))}
          <Link href="/portal">Portal de clientes</Link>
        </nav>
        <div className="site-footer__legal">
          <span>© {new Date().getFullYear()} {web.legal.titular}</span>
          <nav aria-label="Legal" className="row" style={{ gap: 24 }}>
            <Link href="/aviso-legal">Aviso legal</Link>
            <Link href="/privacidad">Privacidad</Link>
            <Link href="/cookies">Cookies</Link>
            <button type="button" className="enlace-boton" onClick={abrirCookies}>Configurar cookies</button>
          </nav>
        </div>
      </div>
    </footer>
  )
}
