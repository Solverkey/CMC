import { redirect } from 'next/navigation'

export default async function EditarDocumentoPagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/portal/documentos/${id}`)
}
