import Link from 'next/link'
import { Bandeja, consultaFiltros, type FiltrosComunicacion } from '@/components/comunicacion/Bandeja'
import { Actualizar } from '@/components/comunicacion/Actualizar'
import { Icon } from '@/components/Icon'
import { contexto } from '@/lib/payload'

export const metadata = { title: 'Comunicación' }

export default async function ComunicacionPage({ searchParams }: { searchParams: Promise<FiltrosComunicacion> }) {
  const sp = await searchParams
  const { user, cmc } = await contexto('/portal/mensajes')
  return (
    <Bandeja user={user} cmc={cmc} sp={sp}>
      <Actualizar cada={60_000} />
      <div className="bandeja__nada">
        <Icon name="chat" />
        <p><strong>Seleccione una conversación</strong></p>
        <p className="small">
          {cmc
            ? 'Las consultas de los clientes, con sus archivos. Las marcadas «Sin responder» esperan una respuesta de CMC.'
            : 'Consultas, comentarios y archivos con CMC, ordenados por conversación. Todo queda registrado y se puede exportar.'}
        </p>
        <Link className="btn btn--primary btn--sm" href={`/portal/mensajes/nuevo${consultaFiltros(sp)}`}><Icon name="chat" />Nueva conversación</Link>
      </div>
    </Bandeja>
  )
}
