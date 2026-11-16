import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import type { User } from '@/payload-types'

export const payloadClient = () => getPayload({ config })

/** Usuario de la sesión (cookie de Payload) o redirección al login del portal. */
export async function requireUser() {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: await nextHeaders() })
  if (!user) redirect('/portal/login')
  return { payload, user: user as User }
}

/** Empresas accesibles por el usuario y la empresa activa (?empresa=ID; por defecto la primera). */
export async function empresasDelUsuario(user: User, activa?: string) {
  const payload = await payloadClient()
  const res = await payload.find({ collection: 'empresas', user, overrideAccess: false, limit: 200, depth: 0, sort: 'razonSocial', where: { activa: { equals: true } } })
  const empresa = res.docs.find((e) => String(e.id) === activa) ?? res.docs[0] ?? null
  return { empresas: res.docs, empresa }
}

export const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')

export function diasHasta(d?: string | null) {
  if (!d) return null
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const f = new Date(d); f.setHours(0, 0, 0, 0)
  return Math.round((f.getTime() - hoy.getTime()) / 86400000)
}
