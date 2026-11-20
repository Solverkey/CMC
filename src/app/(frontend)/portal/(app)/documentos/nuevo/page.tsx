import { redirect } from 'next/navigation'
import { FormDocumento } from '@/components/FormDocumento'
import { contexto } from '@/lib/payload'

export const metadata = { title: 'Nuevo documento' }

export default async function NuevoDocumento({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const { empresa: empresaId } = await searchParams
  const { payload, cmc } = await contexto('/portal/documentos/nuevo')
  if (!cmc) redirect('/portal')
  if (!empresaId) redirect('/portal')

  const [empresa, categorias] = await Promise.all([
    payload.findByID({ collection: 'empresas', id: empresaId, depth: 0, overrideAccess: true }),
    payload.find({ collection: 'categorias', where: { and: [{ empresa: { equals: empresaId } }, { archivada: { not_equals: true } }] }, depth: 0, limit: 200, sort: 'orden', overrideAccess: true }),
  ])

  return (
    <FormDocumento
      empresaId={String(empresa.id)}
      empresaNombre={empresa.razonSocial}
      categorias={categorias.docs.map((c) => ({ id: String(c.id), nombre: c.nombre }))}
    />
  )
}
