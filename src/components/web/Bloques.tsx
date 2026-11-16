import Link from 'next/link'
import { Icon, type IconName } from '@/components/Icon'
import type { Area, DatosWeb } from '@/lib/web'
import { telefonoHref } from '@/lib/web'

export const ICONO_AREA: Record<Area, IconName> = { calidad: 'shield', 'medio-ambiente': 'leaf', gestion: 'file' }

export function Parrafos({ texto, className = 'lead muted' }: { texto: string; className?: string }) {
  return (
    <>
      {texto
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className={className}>
            {p}
          </p>
        ))}
    </>
  )
}

export function CabeceraPagina({ antetitulo, titulo, children }: { antetitulo: string; titulo: string; children?: React.ReactNode }) {
  return (
    <section className="cabecera">
      <div className="container stack" style={{ gap: 12, maxWidth: 1200 }}>
        <p className="eyebrow">{antetitulo}</p>
        <h1 className="display">{titulo}</h1>
        {children ? <div className="stack" style={{ gap: 12, maxWidth: 720 }}>{children}</div> : null}
      </div>
    </section>
  )
}

export function IconoArea({ area }: { area: Area }) {
  return (
    <span className="icono-area" aria-hidden="true">
      <Icon name={ICONO_AREA[area]} size={22} />
    </span>
  )
}

export function BandaContacto({ web, titulo = 'Hablemos de su proyecto' }: { web: DatosWeb; titulo?: string }) {
  return (
    <section className="banda">
      <div className="container section row" style={{ gap: 48, justifyContent: 'space-between' }}>
        <div className="stack" style={{ flex: '1 1 420px', gap: 12 }}>
          <p className="eyebrow" style={{ color: 'var(--olive)' }}>Contacto</p>
          <h2 className="titulo-seccion">{titulo}</h2>
          <p className="lead">Cuéntenos qué necesita y le responderemos en un plazo de dos días laborables.</p>
        </div>
        <div className="stack" style={{ flex: '0 1 360px', gap: 12 }}>
          <Link href="/contacto" className="btn btn--olive">
            Escribirnos <Icon name="arrow" />
          </Link>
          {web.sedes.map((s) => (
            <a key={s.ciudad} href={telefonoHref(s.telefono)} className="banda__tel">
              <Icon name="phone" /> {s.ciudad} · <b>{s.telefono}</b>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
