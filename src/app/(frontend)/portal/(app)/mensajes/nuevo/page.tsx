import Link from 'next/link'
import { EmpresaSelector } from '@/components/EmpresaSelector'
import { MensajeForm } from '@/components/MensajeForm'
import { contexto, empresasDelUsuario } from '@/lib/payload'

export const metadata = { title: 'Nueva conversación' }

export default async function NuevaConversacion({ searchParams }: { searchParams: Promise<{ empresa?: string; documento?: string; categoria?: string }> }) {
  const sp = await searchParams
  const { payload, user } = await contexto('/portal/mensajes/nuevo')
  const { empresas, empresa } = await empresasDelUsuario(user, sp.empresa)
  if (!empresa) return <p>No tiene ninguna empresa asignada.</p>
  const doc = sp.documento ? await payload.findByID({ collection: 'documentos', id: sp.documento, user, overrideAccess: false, depth: 0 }).catch(() => null) : null

  return (
    <>
      <Link href="/portal/mensajes" className="small">← Comunicación con CMC</Link>
      <EmpresaSelector empresas={empresas.map((e) => ({ id: String(e.id), nombre: e.razonSocial }))} activa={String(empresa.id)} />
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{empresa.razonSocial}</p>
        <h1>Nueva conversación</h1>
        {doc && <p className="muted">Sobre el documento «{doc.titulo}».</p>}
      </div>
      <section className="card">
        <MensajeForm empresaId={String(empresa.id)} documentoId={doc ? String(doc.id) : undefined} categoriaId={sp.categoria} asunto={doc ? doc.titulo : undefined} />
      </section>
    </>
  )
}
