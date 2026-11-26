import Link from 'next/link'
import { Bandeja, consultaFiltros, type FiltrosComunicacion } from '@/components/comunicacion/Bandeja'
import { MensajeForm } from '@/components/MensajeForm'
import { categoriaPorId, documentoPorId } from '@/datos/consultas'
import { contexto, empresasDelUsuario, idDe } from '@/lib/payload'

export const metadata = { title: 'Nueva conversación' }

export default async function NuevaConversacion({ searchParams }: { searchParams: Promise<FiltrosComunicacion & { documento?: string; categoria?: string }> }) {
  const sp = await searchParams
  const { user, cmc } = await contexto('/portal/mensajes/nuevo')
  const doc = sp.documento ? await documentoPorId(sp.documento, user) : null
  // Si viene de un documento, la conversación es de su empresa.
  const { empresas, empresa } = await empresasDelUsuario(user, doc ? idDe(doc.empresa) : sp.empresa)
  const categoria = !doc && sp.categoria ? await categoriaPorId(sp.categoria) : null
  const categoriaValida = categoria && empresa && idDe(categoria.empresa) === String(empresa.id) ? categoria : null
  const filtros: FiltrosComunicacion = { empresa: sp.empresa, estado: sp.estado, mias: sp.mias, q: sp.q }

  return (
    <Bandeja user={user} cmc={cmc} sp={filtros} activo="nuevo">
      <header className="conv__cabeza">
        <div className="stack" style={{ gap: 4 }}>
          <Link className="conv__volver small" href={`/portal/mensajes${consultaFiltros(filtros)}`}>← Conversaciones</Link>
          <h2>Nueva conversación</h2>
          <p className="small muted">
            {cmc ? 'Escriba a una empresa cliente. Sus usuarios recibirán un aviso por correo.' : 'Escriba a CMC. Le avisaremos por correo cuando le respondan.'}
          </p>
        </div>
      </header>
      <div className="conv__nueva">
        {!empresa ? (
          <p className="muted">No tiene ninguna empresa asignada.</p>
        ) : (
          <MensajeForm
            key={`${empresa.id}-${doc?.id ?? ''}`}
            empresas={doc ? undefined : empresas.map((e) => ({ id: String(e.id), nombre: e.razonSocial }))}
            empresaId={String(empresa.id)}
            documentoId={doc ? String(doc.id) : undefined}
            categoriaId={categoriaValida ? String(categoriaValida.id) : undefined}
            sobre={doc ? `Documento «${doc.titulo}» · ${empresa.razonSocial}` : categoriaValida ? `Instalación «${categoriaValida.nombre}» · ${empresa.razonSocial}` : undefined}
            asunto={doc ? doc.titulo : undefined}
            filtros={consultaFiltros(filtros)}
          />
        )}
      </div>
    </Bandeja>
  )
}
