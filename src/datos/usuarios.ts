import crypto from 'crypto'
import { AppError } from '@/lib/appError'
import { ahora, bit, ejecutar, filas, uno } from '@/lib/db'
import { crearHashPassword } from '@/lib/clave'
import type { Empresa, User } from './tipos'
import { mapEmpresa, mapUser } from './mapas'

type Fila = Record<string, unknown>

export async function membresiasDe(ids: number[]) {
  const mapa = new Map<number, NonNullable<User['empresas']>>()
  if (!ids.length) return mapa
  const rows = await filas<Fila>(
    `SELECT ue._parent_id AS padre, ue.id, ue.empresa_id, ue.rol, e.razon_social, e.cif, e.activa, e.gestion, e.antelacion_meses, e.tecnico_id, e.updated_at, e.created_at, e.direccion, e.sector, e.contacto, e.logo_id
     FROM users_empresas ue LEFT JOIN empresas e ON e.id = ue.empresa_id
     WHERE ue._parent_id IN (${ids.join(',')}) ORDER BY ue._order`,
  )
  for (const r of rows) {
    const padre = Number(r.padre)
    const lista = mapa.get(padre) ?? []
    const empresa: number | Empresa =
      r.razon_social == null
        ? Number(r.empresa_id)
        : mapEmpresa({
            id: r.empresa_id,
            razon_social: r.razon_social,
            cif: r.cif,
            activa: r.activa,
            gestion: r.gestion,
            antelacion_meses: r.antelacion_meses,
            tecnico_id: r.tecnico_id,
            updated_at: r.updated_at,
            created_at: r.created_at,
            direccion: r.direccion,
            sector: r.sector,
            contacto: r.contacto,
            logo_id: r.logo_id,
          })
    lista.push({ id: String(r.id), empresa, rol: r.rol === 'admin' ? 'admin' : 'usuario' })
    mapa.set(padre, lista)
  }
  return mapa
}

export async function usuarioPorId(id: number | string, secreto = false): Promise<User | null> {
  const row = await uno<Fila>('SELECT * FROM users WHERE id = $1', [Number(id)])
  if (!row) return null
  const empresas = (await membresiasDe([Number(row.id)])).get(Number(row.id)) ?? []
  return mapUser(row, empresas, secreto)
}

export async function usuarioPorEmail(email: string, secreto = false): Promise<User | null> {
  const row = await uno<Fila>('SELECT * FROM users WHERE lower(email) = $1', [email.trim().toLowerCase()])
  if (!row) return null
  const empresas = (await membresiasDe([Number(row.id)])).get(Number(row.id)) ?? []
  return mapUser(row, empresas, secreto)
}

export async function usuarioPorSesion(token: string): Promise<User | null> {
  const row = await uno<Fila>(
    `SELECT u.* FROM users u JOIN users_sessions s ON s._parent_id = u.id WHERE s.id = $1 AND s.expires_at > $2`,
    [token, ahora()],
  )
  if (!row) return null
  const empresas = (await membresiasDe([Number(row.id)])).get(Number(row.id)) ?? []
  return mapUser(row, empresas, false)
}

const ordenSesion = async (userId: number) => Number((await uno<{ n: number }>('SELECT COUNT(*) AS n FROM users_sessions WHERE _parent_id = $1', [userId]))?.n ?? 0)

export async function abrirSesion(userId: number) {
  const id = crypto.randomBytes(24).toString('base64url')
  const creada = ahora()
  const expira = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  await ejecutar(
    'INSERT INTO users_sessions (id, _order, _parent_id, created_at, expires_at) VALUES ($1, $2, $3, $4, $5)',
    [id, await ordenSesion(userId), userId, creada, expira],
  )
  await ejecutar('UPDATE users SET login_attempts = 0, lock_until = NULL, updated_at = $2 WHERE id = $1', [userId, creada])
  return { id, expira }
}

export async function cerrarSesion(token: string) {
  await ejecutar('DELETE FROM users_sessions WHERE id = $1', [token])
}

export async function anotarFallo(userId: number) {
  const u = await uno<{ login_attempts: number }>('SELECT login_attempts FROM users WHERE id = $1', [userId])
  const intentos = Number(u?.login_attempts ?? 0) + 1
  const bloqueo = intentos >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null
  await ejecutar('UPDATE users SET login_attempts = $2, lock_until = $3, updated_at = $4 WHERE id = $1', [userId, intentos, bloqueo, ahora()])
}

export async function guardarPassword(userId: number, password: string) {
  const { hash, salt } = await crearHashPassword(password)
  await ejecutar(
    'UPDATE users SET hash = $2, salt = $3, reset_password_token = NULL, reset_password_expiration = NULL, invitacion_hash = NULL, activo = $4, login_attempts = 0, lock_until = NULL, updated_at = $5 WHERE id = $1',
    [userId, hash, salt, bit(true), ahora()],
  )
}

export function exigirUsuario(user: User | null): User {
  if (!user) throw new AppError('No autenticado.', 401)
  return user
}
