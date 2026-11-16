import type { PayloadRequest } from 'payload'
import type { Categoria, Documento, Empresa, User } from '@/payload-types'

type Dest = { email: string; usuario?: number | string | null; tipo: 'cliente' | 'cmc' }

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string))

async function usuarios(req: PayloadRequest, where: Record<string, unknown>) {
  const { docs } = await req.payload.find({ collection: 'users', where: { and: [{ activo: { not_equals: false } }, where] } as never, limit: 1000, depth: 0, overrideAccess: true, req })
  return docs as User[]
}

/** Super administradores que reciben avisos. */
export async function destinatariosCMC(req: PayloadRequest): Promise<Dest[]> {
  const docs = await usuarios(req, { rol: { equals: 'superadmin' }, recibeAvisos: { equals: true } })
  return docs.map((u) => ({ email: u.email, usuario: u.id, tipo: 'cmc' }))
}

/** Avisos de caducidad del cliente: emails de aviso de la empresa, sus administradores y los usuarios que CMC haya marcado. */
export async function destinatariosCliente(req: PayloadRequest, empresa: Empresa): Promise<Dest[]> {
  const docs = await usuarios(req, { 'empresas.empresa': { equals: empresa.id } })
  const deUsuarios = docs
    .filter((u) => u.empresas?.some((m) => String(idDe(m.empresa)) === String(empresa.id) && (m.rol === 'admin' || u.recibeAvisos)))
    .map((u) => ({ email: u.email, usuario: u.id, tipo: 'cliente' as const }))
  const fijos = (empresa.emailsAviso ?? []).map((e) => ({ email: e.email, tipo: 'cliente' as const }))
  return [...fijos, ...deUsuarios]
}

/** Todos los usuarios activos de una empresa (nuevos documentos, mensajes). */
export async function usuariosEmpresa(req: PayloadRequest, empresaId: number | string): Promise<Dest[]> {
  const docs = await usuarios(req, { 'empresas.empresa': { equals: empresaId } })
  return docs.map((u) => ({ email: u.email, usuario: u.id, tipo: 'cliente' }))
}

/** Técnico de CMC responsable: el del documento, si no el de la categoría, si no el de la empresa. */
export async function tecnicoResponsable(req: PayloadRequest, doc: Pick<Documento, 'tecnico'>, cat?: Pick<Categoria, 'responsable'> | null, empresa?: Pick<Empresa, 'tecnico'> | null) {
  const id = idDe(doc.tecnico) ?? idDe(cat?.responsable) ?? idDe(empresa?.tecnico)
  if (!id) return null
  const u = (await req.payload.findByID({ collection: 'users', id, depth: 0, overrideAccess: true, req }).catch(() => null)) as User | null
  return u && u.activo !== false ? u : null
}
