import type { Metadata } from 'next'
import { Icon } from '@/components/Icon'
import { CabeceraPagina } from '@/components/web/Bloques'
import { ContactoForm } from '@/components/web/ContactoForm'
import { tokenFormulario } from '@/lib/consultas'
import { payloadClient } from '@/lib/payload'
import { leerWeb, serviciosPublicados, telefonoHref } from '@/lib/web'

export const metadata: Metadata = {
  title: 'Contacto',
  description: 'Contacte con CMC en Logroño o en Burgos: teléfono, correo electrónico y formulario de consulta.',
  alternates: { canonical: '/contacto' },
}

export default async function Contacto({ searchParams }: { searchParams: Promise<{ servicio?: string }> }) {
  const { servicio } = await searchParams
  const payload = await payloadClient()
  const [web, servicios] = await Promise.all([leerWeb(payload), serviciosPublicados(payload)])
  const titulos = servicios.map((s) => s.titulo)

  return (
    <>
      <CabeceraPagina antetitulo="Contacto" titulo="Hablemos de su proyecto">
        <p className="lead muted">Escríbanos o llámenos a cualquiera de nuestras dos sedes. Le responderemos en un plazo de dos días laborables.</p>
      </CabeceraPagina>

      <section className="section container row" style={{ gap: 48, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '1 1 320px', gap: 24 }}>
          {web.sedes.map((s) => (
            <div key={s.ciudad} className="stack" style={{ gap: 6 }}>
              <h2 style={{ fontSize: 24, lineHeight: '30px' }}>{s.ciudad}</h2>
              <a className="dato" href={`https://www.openstreetmap.org/search?query=${encodeURIComponent(`${s.direccion}, ${s.codigoPostal}`)}`} target="_blank" rel="noopener noreferrer">
                <Icon name="pin" /> <span>{s.direccion}<br />{s.codigoPostal}</span>
              </a>
              <a className="dato" href={telefonoHref(s.telefono)}>
                <Icon name="phone" /> <b>{s.telefono}</b>
              </a>
            </div>
          ))}
          <a className="dato" href={`mailto:${web.email}`}>
            <Icon name="mail" /> <b>{web.email}</b>
          </a>
          <p className="small muted">¿Ya es cliente? Para enviarnos documentos o consultas sobre su documentación, use el <a href="/portal">portal de clientes</a>: quedará registrado.</p>
        </div>
        <ContactoForm token={tokenFormulario()} servicios={titulos} servicioInicial={titulos.find((t) => t === servicio)} titular={web.legal.titular} />
      </section>
    </>
  )
}
