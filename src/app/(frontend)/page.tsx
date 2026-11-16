import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { SiteFooter, SiteHeader } from '@/components/SiteHeader'
import { StatusBadge } from '@/components/StatusBadge'

const servicios = [
  { icon: 'shield', area: 'Calidad', titulo: 'Implantación ISO 9001', texto: 'Diseñamos su sistema de gestión de la calidad y le acompañamos hasta la certificación.' },
  { icon: 'globe', area: 'Medio ambiente', titulo: 'Implantación ISO 14001', texto: 'Sistemas de gestión medioambiental adaptados a su actividad y a su tamaño.' },
  { icon: 'leaf', area: 'Medio ambiente', titulo: 'Impacto ambiental, fauna y flora', texto: 'Estudios y seguimientos en parques eólicos, líneas eléctricas, fotovoltaicas y canteras.' },
  { icon: 'file', area: 'Gestión', titulo: 'Licencias, ayudas y formación', texto: 'Tramitación de licencias ambientales, subvenciones e informes de sostenibilidad.' },
]

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="container">
            <div className="stack" style={{ flex: '1 1 520px', minWidth: 0, gap: 24 }}>
              <p className="eyebrow" style={{ color: '#d3cf98' }}>Logroño · Burgos · Desde 2000</p>
              <h1 className="display">Calidad y medio ambiente, con rigor técnico</h1>
              <p className="lead" style={{ color: 'var(--slate-soft)', maxWidth: 560 }}>
                Implantamos sistemas ISO 9001 e ISO 14001, realizamos estudios de impacto ambiental y le ayudamos a tener al día toda su documentación regulatoria.
              </p>
              <div className="row">
                <a href="#contacto" className="btn btn--olive">Solicitar información</a>
                <a href="#servicios" className="btn" style={{ borderColor: 'var(--line-strong)', color: 'var(--surface)' }}>Ver servicios</a>
              </div>
            </div>
            <div className="hero__art" aria-hidden="true">
              <div style={{ flex: 1.2, height: '100%', background: 'var(--slate)' }} />
              <div style={{ flex: 1, height: '62%', background: 'var(--olive)' }} />
              <div style={{ flex: 0.8, height: '82%', background: 'var(--slate-soft)' }} />
            </div>
          </div>
        </section>

        <section id="servicios" className="section container stack" style={{ gap: 32 }}>
          <div className="stack" style={{ gap: 8, maxWidth: 640 }}>
            <p className="eyebrow">Servicios</p>
            <h2 style={{ fontSize: 40, lineHeight: '46px' }}>Dos áreas, un mismo equipo</h2>
            <p className="lead muted">Biólogos e ingenieros con más de veinte años de experiencia en calidad y en la integración ambiental de proyectos.</p>
          </div>
          <div className="grid-auto">
            {servicios.map((s) => (
              <article key={s.titulo} className="card stack" style={{ gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--olive-soft)', color: 'var(--olive-deep)', display: 'grid', placeItems: 'center' }}>
                  <Icon name={s.icon} size={22} />
                </div>
                <p className="eyebrow">{s.area}</p>
                <h3>{s.titulo}</h3>
                <p className="muted">{s.texto}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={{ background: 'var(--olive-soft)' }}>
          <div className="container section row" style={{ gap: 48 }}>
            <div className="stack" style={{ flex: '1 1 480px', minWidth: 0 }}>
              <p className="eyebrow">Portal documental</p>
              <h2 style={{ fontSize: 40, lineHeight: '46px' }}>Toda su documentación, al día y en un solo sitio</h2>
              <p className="lead">Certificados ISO, inspecciones OCA y licencias con su fecha de caducidad a la vista. Le avisamos antes de que venzan y puede enviarnos las renovaciones desde el portal.</p>
              <div><Link href="/portal" className="btn btn--primary">Entrar al portal</Link></div>
            </div>
            <div aria-hidden="true" className="card stack" style={{ flex: '1 1 360px', minWidth: 0, gap: 12, boxShadow: 'var(--shadow-card)' }}>
              <div className="row" style={{ justifyContent: 'space-between' }}><strong>Certificado ISO 9001</strong><StatusBadge estado="verde" /></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><strong>OCA baja tensión · Nave 2</strong><StatusBadge estado="naranja" /></div>
              <div className="row" style={{ justifyContent: 'space-between' }}><strong>Licencia ambiental</strong><StatusBadge estado="amarillo" /></div>
            </div>
          </div>
        </section>

        <section id="clientes" className="section container stack" style={{ gap: 32 }}>
          <div className="stack" style={{ gap: 8 }}>
            <p className="eyebrow">Clientes</p>
            <h2 style={{ fontSize: 40, lineHeight: '46px' }}>Han confiado en nosotros</h2>
          </div>
          {/* TODO: logos reales de clientes (colección media) */}
          <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 88, border: '1px dashed var(--line-strong)', borderRadius: 8, display: 'grid', placeItems: 'center' }} className="small muted">[LOGO CLIENTE]</div>
            ))}
          </div>
        </section>

        <section id="contacto" style={{ background: 'var(--surface-raised)', borderTop: '1px solid var(--line)' }}>
          <div className="container section row" style={{ gap: 48, alignItems: 'flex-start' }}>
            <div className="stack" style={{ flex: '1 1 360px', gap: 24 }}>
              <div className="stack" style={{ gap: 8 }}>
                <p className="eyebrow">Contacto</p>
                <h2 style={{ fontSize: 40, lineHeight: '46px' }}>Hablemos de su proyecto</h2>
              </div>
              <div className="stack" style={{ gap: 4 }}><h3>Logroño</h3><span className="muted">C/ General Vara de Rey, 48 · 26002 Logroño</span><a href="tel:+34941287108"><b>941 28 71 08</b></a></div>
              <div className="stack" style={{ gap: 4 }}><h3>Burgos</h3><span className="muted">C/ Vitoria, 17 · 09004 Burgos</span><a href="tel:+34669479449"><b>669 47 94 49</b></a></div>
              <a href="mailto:info@consultoracmc.es"><b>info@consultoracmc.es</b></a>
            </div>
            {/* TODO: conectar a un endpoint de envío (Payload form-builder o API route + correo transaccional) */}
            <form className="card stack" style={{ flex: '1 1 480px', minWidth: 0, background: 'var(--surface)' }} action="#">
              <div className="row" style={{ gap: 16, alignItems: 'stretch' }}>
                <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="c-nombre">Nombre</label><input id="c-nombre" name="nombre" required /></div>
                <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="c-empresa">Empresa</label><input id="c-empresa" name="empresa" /></div>
              </div>
              <div className="field"><label htmlFor="c-email">Correo electrónico</label><input id="c-email" name="email" type="email" required /></div>
              <div className="field"><label htmlFor="c-msg">¿En qué podemos ayudarle?</label><textarea id="c-msg" name="mensaje" rows={5} required /></div>
              <div className="row small muted"><input id="c-priv" type="checkbox" required /><label htmlFor="c-priv">He leído y acepto la <a href="/privacidad">política de privacidad</a></label></div>
              <div><button className="btn btn--primary" type="submit">Enviar consulta</button></div>
            </form>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
