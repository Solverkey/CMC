import { notFound, redirect } from 'next/navigation'
import { FormDocumento } from '@/components/FormDocumento'
import { contexto, idDe } from '@/lib/payload'

export const metadata = { title: 'Editar documento' }

const dia = (v?: string | null) => (v ? v.slice(0, 10) : '')

export default async function EditarDocumento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user, cmc } = await contexto(`/portal/documentos/${id}/editar`)
  if (!cmc) redirect(`/portal/documentos/${id}`)
  const doc = await payload.findByID({ collection: 'documentos', id, user, overrideAccess: false, depth: 1 }).catch(() => null)
  if (!doc) notFound()
  const empresaId = String(idDe(doc.empresa))
  const categorias = await payload.find({ collection: 'categorias', where: { and: [{ empresa: { equals: empresaId } }, { archivada: { not_equals: true } }] }, depth: 0, limit: 200, sort: 'orden', overrideAccess: true })

  return (
    <FormDocumento
      id={String(doc.id)}
      empresaId={empresaId}
      empresaNombre={typeof doc.empresa === 'object' ? doc.empresa.razonSocial : ''}
      categorias={categorias.docs.map((c) => ({ id: String(c.id), nombre: c.nombre }))}
      valores={{
        titulo: doc.titulo,
        categoria: String(idDe(doc.categoria)),
        referencia: doc.referencia ?? '',
        organismo: doc.organismo ?? '',
        fechaEmision: dia(doc.fechaEmision),
        fechaCaducidad: dia(doc.fechaCaducidad),
        fechaAviso: dia(doc.fechaAviso),
        estadoManual: doc.estadoManual ?? '',
        motivoEstado: doc.motivoEstado ?? '',
        limiteSubsanacion: dia(doc.limiteSubsanacion),
        gestion: doc.gestion ?? '',
        observaciones: doc.observaciones ?? '',
      }}
    />
  )
}
