import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { createLocalReq, getPayload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import type { User } from '@/payload-types'
import { esSuperAdmin, superAdminSin2FA } from '@/access'

export const payloadClient = () => getPayload({ config })

/** Usuario de la sesión (cookie de Payload) o redirección al login del portal, volviendo después a `next`. */
export async function requireUser(next?: string) {
  const h = await nextHeaders()
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: h })
  if (!user || user.collection !== 'users') redirect(next ? `/portal/login?next=${encodeURIComponent(next)}` : '/portal/login')
  return { payload, user: user as User }
}

/**
 * Sesión y una petición local con ese usuario, para usar los mismos servicios que la API y el servidor MCP.
 * Un super administrador sin doble factor no tiene permisos: se le lleva a activarlo antes de consultar nada.
 */
export async function contexto(next?: string, { permitirSin2FA = false } = {}) {
  const { payload, user } = await requireUser(next)
  if (!permitirSin2FA && next !== '/portal/seguridad' && superAdminSin2FA(user)) redirect('/portal/seguridad')
  const req = await createLocalReq({ user: { ...user, collection: 'users' } as never, req: { headers: new Headers(await nextHeaders()) } as Partial<PayloadRequest> }, payload)
  return { payload, user, req, cmc: esSuperAdmin(user) }
}

/** Empresas accesibles por el usuario y la empresa activa (?empresa=ID; por defecto la primera). */
export async function empresasDelUsuario(user: User, activa?: string) {
  const payload = await payloadClient()
  const res = await payload.find({ collection: 'empresas', user, overrideAccess: false, limit: 1000, depth: 1, sort: 'razonSocial', where: { activa: { equals: true } } })
  const empresa = res.docs.find((e) => String(e.id) === activa) ?? res.docs[0] ?? null
  return { empresas: res.docs, empresa }
}

export const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
export const fmtHora = (d?: string | null) => (d ? new Date(d).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

export function diasHasta(d?: string | null) {
  if (!d) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(d)
  f.setHours(0, 0, 0, 0)
  return Math.round((f.getTime() - hoy.getTime()) / 86400000)
}

export const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? String((v as { id: number | string }).id) : v == null ? '' : String(v))
