import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { BandaContacto, CabeceraPagina, IconoArea } from '@/components/web/Bloques'
import { AREAS, leerWeb, serviciosPublicados } from '@/lib/web'

export const metadata: Metadata = {
  title: 'Servicios',
  description: 'Implantación ISO 9001 e ISO 14001, EFQM, auditorías, estudios de impacto ambiental, seguimientos de fauna y flora, restauración, licencias ambientales y tramitaciones.',
  alternates: { canonical: '/servicios' },
}

export default async function ServiciosPage() {
  const [web, servicios] = await Promise.all([leerWeb(), serviciosPublicados()])
  const grupos = AREAS.map((a) => ({ ...a, servicios: servicios.filter((s) => s.area === a.value) })).filter((g) => g.servicios.length)

  return (
    <>
      <CabeceraPagina antetitulo="Servicios" titulo="Calidad, medio ambiente y gestión">
        <p className="lead muted">Le acompañamos desde el diagnóstico inicial hasta la certificación, la autorización o el seguimiento en explotación.</p>
        <nav aria-label="Áreas" className="row">
          {grupos.map((g) => (
            <a key={g.value} href={`#${g.value}`} className="btn btn--secondary btn--sm">{g.label}</a>
          ))}
        </nav>
      </CabeceraPagina>

      {grupos.map((g, i) => (
        <section key={g.value} id={g.value} className="ancla" style={i % 2 ? { background: 'var(--surface-sunken)' } : undefined}>
          <div className="section container stack" style={{ gap: 32 }}>
            <div className="area-cabeza">
              <IconoArea area={g.value} />
              <div className="stack" style={{ gap: 4 }}>
                <h2 className="titulo-seccion">{g.titulo}</h2>
                <p className="muted">{g.texto}</p>
              </div>
            </div>
            <div className="grid-auto">
              {g.servicios.map((s) => (
                <article key={s.id} id={s.slug ?? undefined} className="card stack ancla" style={{ gap: 12 }}>
                  <h3>{s.titulo}</h3>
                  <p className="muted">{s.resumen}</p>
                  {s.puntos?.length ? (
                    <ul className="lista-check small">
                      {s.puntos.map((p) => <li key={p.id ?? p.texto}><Icon name="check" size={16} /> {p.texto}</li>)}
                    </ul>
                  ) : null}
                  {s.enlace ? <Link href={s.enlace} className="mas">{s.textoEnlace || 'Más información'} <Icon name="arrow" size={16} /></Link> : null}
                </article>
              ))}
            </div>
          </div>
        </section>
      ))}

      <BandaContacto web={web} titulo="¿No encuentra lo que busca?" />
    </>
  )
}
