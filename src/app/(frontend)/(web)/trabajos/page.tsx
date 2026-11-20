import type { Metadata } from 'next'
import Link from 'next/link'
import { BandaContacto, CabeceraPagina, IconoArea } from '@/components/web/Bloques'
import { AREAS, areaDe, clientesDe, leerWeb, trabajosPublicados, type Area } from '@/lib/web'

export const metadata: Metadata = {
  title: 'Trabajos realizados',
  description: 'Seguimientos ambientales de parques eólicos y líneas eléctricas, estudios de impacto ambiental, restauración y permisos de servidumbre realizados por CMC.',
  alternates: { canonical: '/trabajos' },
}

export default async function TrabajosPage({ searchParams }: { searchParams: Promise<{ area?: string }> }) {
  const { area } = await searchParams
  const [web, todos] = await Promise.all([leerWeb(), trabajosPublicados()])
  const filtro = AREAS.some((a) => a.value === area) ? (area as Area) : null
  const trabajos = filtro ? todos.filter((t) => t.area === filtro) : todos
  const areas = AREAS.filter((a) => todos.some((t) => t.area === a.value))
  const clientes = clientesDe(todos)

  return (
    <>
      <CabeceraPagina antetitulo="Trabajos realizados" titulo="Referencias">
        <p className="lead muted">Una selección de los trabajos que hemos realizado para administraciones públicas, promotores de energías renovables y compañías eléctricas.</p>
      </CabeceraPagina>

      <section className="section container stack" style={{ gap: 32 }}>
        {areas.length > 1 ? (
          <nav aria-label="Filtrar por área" className="row segmentado" style={{ alignSelf: 'flex-start' }}>
            <Link href="/trabajos" className="btn btn--sm" aria-current={!filtro}>Todos</Link>
            {areas.map((a) => (
              <Link key={a.value} href={`/trabajos?area=${a.value}`} className="btn btn--sm" aria-current={filtro === a.value}>{a.label}</Link>
            ))}
          </nav>
        ) : null}

        {trabajos.length ? (
          <ol className="trabajos">
            {trabajos.map((t) => (
              <li key={t.id} className="card row" style={{ alignItems: 'flex-start', gap: 20, flexWrap: 'nowrap' }}>
                <IconoArea area={t.area as Area} />
                <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                  <p className="eyebrow">{areaDe(t.area).label}{t.anio ? ` · ${t.anio}` : ''}</p>
                  <h2 style={{ fontSize: 20, lineHeight: '28px' }}>{t.titulo}</h2>
                  {t.descripcion ? <p className="muted">{t.descripcion}</p> : null}
                  {t.cliente || t.lugar ? <p className="small"><b>{[t.cliente, t.lugar].filter(Boolean).join(' · ')}</b></p> : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Todavía no hay trabajos publicados en esta área.</p>
        )}

        {clientes.length ? (
          <div className="stack" style={{ gap: 12 }}>
            <h2 className="titulo-seccion" style={{ fontSize: 28 }}>Han confiado en nosotros</h2>
            <ul className="clientes">
              {clientes.map((c) => <li key={c}>{c}</li>)}
            </ul>
          </div>
        ) : null}
      </section>

      <BandaContacto web={web} />
    </>
  )
}
