import type { Metadata } from 'next'
import { BandaContacto, CabeceraPagina, Parrafos } from '@/components/web/Bloques'
import { payloadClient } from '@/lib/payload'
import { leerWeb } from '@/lib/web'

export const metadata: Metadata = {
  title: 'Quiénes somos',
  description: 'CMC trabaja desde el año 2000 en calidad y medio ambiente, con un equipo de biólogos e ingenieros en Logroño y Burgos.',
  alternates: { canonical: '/quienes-somos' },
}

export default async function QuienesSomos() {
  const web = await leerWeb(await payloadClient())
  return (
    <>
      <CabeceraPagina antetitulo="Quiénes somos" titulo="Más de veinte años en calidad y medio ambiente" />

      <section className="section container row" style={{ gap: 48, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '2 1 520px', gap: 16 }}>
          <h2 className="titulo-seccion">Presentación</h2>
          <Parrafos texto={web.presentacion} className="lead" />
        </div>
        <dl className="cifras" style={{ flex: '1 1 260px' }}>
          <div><dt>Desde</dt><dd>2000</dd></div>
          <div><dt>Sedes</dt><dd>{web.sedes.length}</dd></div>
          <div><dt>Áreas</dt><dd>Calidad y medio ambiente</dd></div>
        </dl>
      </section>

      <section style={{ background: 'var(--surface-sunken)' }}>
        <div className="section container stack" style={{ gap: 32 }}>
          <div className="stack" style={{ gap: 8, maxWidth: 680 }}>
            <p className="eyebrow">Equipo</p>
            <h2 className="titulo-seccion">Formación técnica y experiencia de campo</h2>
          </div>
          <div className="grid-auto">
            {web.profesionales.map((p) => (
              <article key={p.titulo} className="card stack" style={{ gap: 12 }}>
                <h3>{p.titulo}</h3>
                <p className="muted">{p.texto}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <BandaContacto web={web} />
    </>
  )
}
