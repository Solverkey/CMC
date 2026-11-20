import type { Categoria, Documento, Empresa, User } from '@/datos/tipos'
import { bit, filas, uno } from './db'
import type { Ctx } from './ctx'
import { mapUser } from '@/datos/mapas'
import { membresiasDe } from '@/datos/usuarios'

type Dest = { email: string; usuario?: number | string | null; tipo: 'cliente' | 'cmc' }
type Fila = Record<string, unknown>

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string))

async function usuariosActivos(where: string, params: unknown[] = []) {
  const rows = await filas<Fila>(`SELECT * FROM users WHERE (activo IS NULL OR activo IS NOT FALSE) AND ${where}`, params)
  const mapa = await membresiasDe(rows.map((r) => Number(r.id)))
  return rows.map((r) => mapUser(r, mapa.get(Number(r.id)) ?? []))
}

/** Super administradores que reciben avisos. */
export async function destinatariosCMC(_req?: Ctx): Promise<Dest[]> {
  const docs = await usuariosActivos('rol = $1 AND recibe_avisos = $2', ['superadmin', bit(true)])
  return docs.filter((u) => u.activo !== false && u.recibeAvisos).map((u) => ({ email: u.email, usuario: u.id, tipo: 'cmc' as const }))
}

/** Avisos de caducidad del cliente: emails de aviso de la empresa, sus administradores y los usuarios que CMC haya marcado. */
export async function destinatariosCliente(_req: Ctx, empresa: Empresa): Promise<Dest[]> {
  const docs = await usuariosActivos(`id IN (SELECT _parent_id FROM users_empresas WHERE empresa_id = $1)`, [empresa.id])
  const deUsuarios = docs
    .filter((u) => u.empresas?.some((m) => String(idDe(m.empresa)) === String(empresa.id) && (m.rol === 'admin' || u.recibeAvisos)))
    .map((u) => ({ email: u.email, usuario: u.id, tipo: 'cliente' as const }))
  const fijos = (empresa.emailsAviso ?? []).map((e) => ({ email: e.email, tipo: 'cliente' as const }))
  return [...fijos, ...deUsuarios]
}

/** Todos los usuarios activos de una empresa (nuevos documentos, mensajes). */
export async function usuariosEmpresa(_req: Ctx, empresaId: number | string): Promise<Dest[]> {
  const docs = await usuariosActivos(`id IN (SELECT _parent_id FROM users_empresas WHERE empresa_id = $1)`, [empresaId])
  return docs.map((u) => ({ email: u.email, usuario: u.id, tipo: 'cliente' as const }))
}

/** Técnico de CMC responsable: el del documento, si no el de la categoría, si no el de la empresa. */
export async function tecnicoResponsable(_req: Ctx, doc: Pick<Documento, 'tecnico'>, cat?: Pick<Categoria, 'responsable'> | null, empresa?: Pick<Empresa, 'tecnico'> | null) {
  const id = idDe(doc.tecnico) || idDe(cat?.responsable) || idDe(empresa?.tecnico)
  if (!id) return null
  const row = await uno<Fila>('SELECT * FROM users WHERE id = $1', [id])
  if (!row) return null
  const u = mapUser(row, [])
  return u.activo !== false ? u : null
}
