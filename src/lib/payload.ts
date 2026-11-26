import { headers as nextHeaders } from 'next/headers'
import { redirect } from 'next/navigation'
import { esSuperAdmin, empresasDe, superAdminSin2FA } from '@/access'
import { mapEmpresa } from '@/datos/mapas'
import type { Empresa, User } from '@/datos/tipos'
import { bit, filas } from '@/lib/db'
import type { Ctx } from './ctx'
import { leerSesion } from './sesion'

type Fila = Record<string, unknown>

/** Usuario de la sesión o redirección al login del portal, volviendo después a `next`. */
export async function requireUser(next?: string) {
  const user = await leerSesion()
  if (!user) redirect(next ? `/portal/login?next=${encodeURIComponent(next)}` : '/portal/login')
  return { user }
}

/**
 * Sesión del portal. Un super administrador sin doble factor no tiene permisos:
 * se le lleva a activarlo antes de consultar nada.
 */
export async function contexto(next?: string, { permitirSin2FA = false } = {}) {
  const { user } = await requireUser(next)
  if (!permitirSin2FA && next !== '/portal/seguridad' && superAdminSin2FA(user)) redirect('/portal/seguridad')
  const req: Ctx = { user, headers: new Headers(await nextHeaders()), origen: 'web', context: {} }
  return { user, req, cmc: esSuperAdmin(user) }
}

async function conEmails(rows: Fila[]): Promise<Empresa[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => Number(r.id))
  const avisos = await filas<Fila>(`SELECT _parent_id AS padre, id, email FROM empresas_emails_aviso WHERE _parent_id IN (${ids.join(',')}) ORDER BY _order`)
  const porEmpresa = new Map<number, { email: string; id: string }[]>()
  for (const a of avisos) {
    const lista = porEmpresa.get(Number(a.padre)) ?? []
    lista.push({ email: String(a.email), id: String(a.id) })
    porEmpresa.set(Number(a.padre), lista)
  }
  return rows.map((r) => mapEmpresa(r, porEmpresa.get(Number(r.id)) ?? []))
}

/** Empresas accesibles por el usuario y la empresa activa (?empresa=ID; por defecto la primera). */
export async function empresasDelUsuario(user: User, activa?: string) {
  const activaBit = bit(true)
  const ids = esSuperAdmin(user) ? null : empresasDe(user).map(Number)
  if (ids && !ids.length) return { empresas: [] as Empresa[], empresa: null }
  const rows = await filas<Fila>(
    ids
      ? `SELECT * FROM empresas WHERE activa = $1 AND id IN (${ids.join(',')}) ORDER BY razon_social`
      : 'SELECT * FROM empresas WHERE activa = $1 ORDER BY razon_social',
    [activaBit],
  )
  const empresas = await conEmails(rows)
  const empresa = empresas.find((e) => String(e.id) === activa) ?? empresas[0] ?? null
  return { empresas, empresa }
}

export const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
export const fmtHora = (d?: string | null) => (d ? new Date(d).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

export function diasHasta(d?: string | null) {
  if (!d) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const f = new Date(d)
  f.setHours(0, 0, 0, 0)
  return Math.round((f.getTime() - hoy.getTime()) / 86400000)
}

export const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? String((v as { id: number | string }).id) : v == null ? '' : String(v))
