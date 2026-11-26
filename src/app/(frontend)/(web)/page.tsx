import { urlServidor } from '@/lib/url'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { StatusBadge } from '@/components/StatusBadge'
import { BandaContacto, IconoArea } from '@/components/web/Bloques'
import { CarruselPortada } from '@/components/web/CarruselPortada'
import { videosRemotos, videosSueltos } from '@/lib/portada'
import { AREAS, areaDe, clientesDe, leerWeb, serviciosPublicados, trabajosPublicados, type Area } from '@/lib/web'

export async function generateMetadata(): Promise<Metadata> {
  const web = await leerWeb()
  return { title: { absolute: 'CMC · Consultoría de calidad y medio ambiente' }, description: web.descripcion, alternates: { canonical: '/' } }
}

export default async function Inicio() {
  const [web, servicios, trabajos] = await Promise.all([leerWeb(), serviciosPublicados(), trabajosPublicados()])
  const destacados = (servicios.filter((s) => s.destacado).length ? servicios.filter((s) => s.destacado) : servicios).slice(0, 6)
  const clientes = clientesDe(trabajos)
  const { portada } = web
  const videos = [...new Set([...(await videosRemotos()), ...portada.videos, ...videosSueltos()])]

  const datosEstructurados = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: web.legal.titular,
    description: web.descripcion,
    email: web.email,
    url: urlServidor(),
    foundingDate: '2000',
    address: web.sedes.map((s) => ({ '@type': 'PostalAddress', streetAddress: s.direccion, addressLocality: s.ciudad, postalCode: s.codigoPostal.split(' ')[0], addressCountry: 'ES' })),
    telephone: web.sedes.map((s) => `+34 ${s.telefono}`),
    areaServed: ['La Rioja', 'Castilla y León'],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datosEstructurados).replace(/</g, '\\u003c') }} />

      <section className="hero">
        <div className="container">
          <div className="hero__texto stack">
            <p className="eyebrow" style={{ color: 'var(--olive)' }}>{portada.antetitulo}</p>
            <h1 className="display">{portada.titulo}</h1>
            <p className="lead">{portada.subtitulo}</p>
            <div className="hero__acciones">
              <Link href="/contacto" className="btn btn--olive">Solicitar información</Link>
              <Link href="/servicios" className="btn btn--claro">Ver servicios</Link>
            </div>
          </div>
          <CarruselPortada fuentes={videos}>
            {portada.imagen?.url ? (
              // eslint-disable-next-line @next/next/no-img-element -- la imagen puede venir de S3
              <img className="hero__foto" src={portada.imagen.url} alt={portada.imagen.alt} />
            ) : (
              <div className="hero__art" aria-hidden="true">
                <div style={{ flex: 1.2, height: '100%', background: 'var(--slate)' }} />
                <div style={{ flex: 1, height: '62%', background: 'var(--olive)' }} />
                <div style={{ flex: 0.8, height: '82%', background: 'var(--slate-soft)' }} />
              </div>
            )}
          </CarruselPortada>
        </div>
      </section>

      <section className="section container stack" style={{ gap: 32 }}>
        <div className="stack" style={{ gap: 8, maxWidth: 680 }}>
          <p className="eyebrow">Qué hacemos</p>
          <h2 className="titulo-seccion">Tres áreas, un mismo equipo</h2>
          <p className="lead muted">Biólogos e ingenieros con más de veinte años de experiencia en calidad y en la integración ambiental de proyectos.</p>
        </div>
        <div className="grid-auto">
          {AREAS.map((a) => (
            <Link key={a.value} href={`/servicios#${a.value}`} className="card card--enlace stack" style={{ gap: 12 }}>
              <IconoArea area={a.value} />
              <h3>{a.titulo}</h3>
              <p className="muted">{a.texto}</p>
              <span className="mas">Ver servicios <Icon name="arrow" size={16} /></span>
            </Link>
          ))}
        </div>
      </section>

      {destacados.length ? (
        <section style={{ background: 'var(--surface-sunken)' }}>
          <div className="section container stack" style={{ gap: 32 }}>
            <div className="seccion-cabeza">
              <div className="stack" style={{ gap: 8 }}>
                <p className="eyebrow">Servicios</p>
                <h2 className="titulo-seccion">Lo que más nos piden</h2>
              </div>
              <Link href="/servicios" className="btn btn--secondary">Todos los servicios</Link>
            </div>
            <div className="grid-auto">
              {destacados.map((s) => (
                <Link key={s.id} href={`/servicios#${s.slug}`} className="card card--enlace stack" style={{ gap: 12 }}>
                  <p className="eyebrow">{areaDe(s.area).label}</p>
                  <h3>{s.titulo}</h3>
                  <p className="muted">{s.resumen}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section style={{ background: 'var(--olive-soft)' }}>
        <div className="container section reparto reparto--centro">
          <div className="stack reparto__ancho">
            <p className="eyebrow">Portal documental</p>
            <h2 className="titulo-seccion">Toda su documentación, al día y en un solo sitio</h2>
            <p className="lead">Las instalaciones de alta tensión, baja tensión y el resto de tipos, con su fecha de caducidad a la vista. Le avisamos antes de que venzan y puede enviarnos las renovaciones desde el portal.</p>
            <ul className="lista-check">
              <li><Icon name="check" /> Avisos por correo antes de cada caducidad</li>
              <li><Icon name="check" /> Histórico completo: nada se borra al renovar</li>
              <li><Icon name="check" /> Envío de documentos y conversaciones con CMC registradas</li>
              <li><Icon name="check" /> Acceso seguro para cada persona de su empresa</li>
            </ul>
            <div><Link href="/portal" className="btn btn--primary">Entrar al portal</Link></div>
          </div>
          <div aria-hidden="true" className="card stack vista-portal reparto__estrecho" style={{ gap: 12, boxShadow: 'var(--shadow-card)' }}>
            <div className="vista-portal__fila"><strong>Alta tensión · Centro 1</strong><StatusBadge estado="verde" /></div>
            <div className="vista-portal__fila"><strong>Baja tensión · Nave 2</strong><StatusBadge estado="amarillo" /></div>
            <div className="vista-portal__fila"><strong>Baja tensión · Oficina</strong><StatusBadge estado="naranja" /></div>
            <div className="vista-portal__fila"><strong>Alta tensión · Nave 4</strong><StatusBadge estado="rojo" /></div>
          </div>
        </div>
      </section>

      {trabajos.length ? (
        <section className="section container stack" style={{ gap: 32 }}>
          <div className="seccion-cabeza">
            <div className="stack" style={{ gap: 8 }}>
              <p className="eyebrow">Trabajos realizados</p>
              <h2 className="titulo-seccion">Experiencia sobre el terreno</h2>
            </div>
            <Link href="/trabajos" className="btn btn--secondary">Ver todos los trabajos</Link>
          </div>
          <div className="grid-auto">
            {trabajos.slice(0, 3).map((t) => (
              <article key={t.id} className="card stack" style={{ gap: 12 }}>
                <IconoArea area={t.area as Area} />
                <h3 style={{ fontSize: 19, lineHeight: '26px' }}>{t.titulo}</h3>
                {t.cliente || t.lugar ? <p className="small muted">{[t.lugar, t.cliente].filter(Boolean).join(' · ')}</p> : null}
              </article>
            ))}
          </div>
          {clientes.length ? (
            <div className="stack" style={{ gap: 12 }}>
              <p className="eyebrow">Han confiado en nosotros</p>
              <ul className="clientes">
                {clientes.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <BandaContacto web={web} />
    </>
  )
}
