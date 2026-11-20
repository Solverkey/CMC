import { esSuperAdmin } from '@/access'
import { AppError } from '@/lib/appError'
import { registrar } from '@/lib/actividad'
import { hash, tokenAleatorio } from '@/lib/cifrado'
import { cifrarClaveApi, indiceClave } from '@/lib/clave'
import type { Ctx } from '@/lib/ctx'
import { ahora, bit, ejecutar, filas, uno } from '@/lib/db'
import { usuarioPorId } from '@/datos/usuarios'

export const COLECCION_CLAVES = 'payload_mcp_api_keys'
export const HORAS_ACCESO = 8
export const DIAS_RENOVACION = 30
const LIMITE_MINUTO = 60
const LIMITE_DIA = 3000

type Clave = {
  id: number
  user_id: number
  label: string | null
  origen: string | null
  client_id: string | null
  caduca: string | null
  renovacion_hash: string | null
  renovacion_caduca: string | null
  ultimo_uso: string | null
}

export async function crearClave(req: Ctx, d: { usuario: number | string; label: string; origen: 'oauth' | 'manual'; clientId?: string; dias?: number }) {
  const apiKey = `cmc_${tokenAleatorio(32)}`
  const renovacion = d.origen === 'oauth' ? tokenAleatorio(32) : undefined
  const momento = Date.now()
  const caduca = new Date(momento + (d.origen === 'oauth' ? HORAS_ACCESO * 3600_000 : (d.dias ?? 90) * 86400_000)).toISOString()
  const row = await uno<{ id: number }>(
    `INSERT INTO payload_mcp_api_keys (user_id, label, origen, client_id, caduca, renovacion_hash, renovacion_caduca, enable_a_p_i_key, api_key, api_key_index, updated_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING id`,
    [Number(d.usuario), d.label, d.origen, d.clientId ?? null, caduca, renovacion ? hash(renovacion) : null, renovacion ? new Date(momento + DIAS_RENOVACION * 86400_000).toISOString() : null, bit(true), cifrarClaveApi(apiKey), indiceClave(apiKey), ahora()],
  )
  await registrar(req, { accion: 'seguridad', descripcion: `Nuevo acceso de IA «${d.label}» (${d.origen === 'oauth' ? 'OAuth' : 'clave'})`, coleccion: COLECCION_CLAVES, registroId: row!.id, usuario: { id: d.usuario } })
  return { id: row!.id, apiKey, renovacion, expiresIn: d.origen === 'oauth' ? HORAS_ACCESO * 3600 : undefined }
}

export async function renovarClave(req: Ctx, renovacion: string, clientId: string) {
  const k = await uno<Clave>('SELECT * FROM payload_mcp_api_keys WHERE renovacion_hash = $1 LIMIT 1', [hash(renovacion)])
  if (!k || k.client_id !== clientId || !k.renovacion_caduca || new Date(k.renovacion_caduca) < new Date()) throw new AppError('invalid_grant', 400)
  const apiKey = `cmc_${tokenAleatorio(32)}`
  const nueva = tokenAleatorio(32)
  const caduca = new Date(Date.now() + HORAS_ACCESO * 3600_000).toISOString()
  await ejecutar(
    `UPDATE payload_mcp_api_keys SET api_key = $2, api_key_index = $3, enable_a_p_i_key = $4, caduca = $5, renovacion_hash = $6, renovacion_caduca = $7, updated_at = $8 WHERE id = $1`,
    [k.id, cifrarClaveApi(apiKey), indiceClave(apiKey), bit(true), caduca, hash(nueva), new Date(Date.now() + DIAS_RENOVACION * 86400_000).toISOString(), ahora()],
  )
  void req
  return { apiKey, renovacion: nueva, expiresIn: HORAS_ACCESO * 3600 }
}

export async function revocarClave(req: Ctx, id: number | string) {
  const k = await uno<Clave>('SELECT * FROM payload_mcp_api_keys WHERE id = $1', [Number(id)])
  if (!k) throw new AppError('Acceso no encontrado.', 404)
  if (!esSuperAdmin(req.user) && String(k.user_id) !== String(req.user?.id)) throw new AppError('No puede revocar ese acceso.', 403)
  await ejecutar('DELETE FROM payload_mcp_api_keys WHERE id = $1', [k.id])
  await registrar(req, { accion: 'seguridad', descripcion: `Revocado el acceso de IA «${k.label ?? k.id}»`, coleccion: COLECCION_CLAVES, registroId: k.id })
}

export async function clavesDe(userId: number | string, todas: boolean) {
  const rows = await filas<Clave>(todas ? 'SELECT * FROM payload_mcp_api_keys ORDER BY created_at DESC' : 'SELECT * FROM payload_mcp_api_keys WHERE user_id = $1 ORDER BY created_at DESC', todas ? [] : [Number(userId)])
  return rows
}

const usos = new Map<string, { minuto: number; enMinuto: number; dia: string; enDia: number }>()

export async function usuarioDeClave(apiKey: string) {
  const k = await uno<Clave & Record<string, unknown>>('SELECT * FROM payload_mcp_api_keys WHERE api_key_index = $1 LIMIT 1', [indiceClave(apiKey)])
  if (!k) return null
  if (k.caduca && new Date(k.caduca) < new Date()) return null
  const user = await usuarioPorId(k.user_id)
  if (!user || user.activo === false) return null
  const id = String(k.id)
  const ahoraMs = Date.now()
  const minuto = Math.floor(ahoraMs / 60_000)
  const dia = new Date().toISOString().slice(0, 10)
  const u = usos.get(id) ?? { minuto, enMinuto: 0, dia, enDia: 0 }
  if (u.minuto !== minuto) Object.assign(u, { minuto, enMinuto: 0 })
  if (u.dia !== dia) Object.assign(u, { dia, enDia: 0 })
  u.enMinuto++
  u.enDia++
  usos.set(id, u)
  if (u.enMinuto > LIMITE_MINUTO || u.enDia > LIMITE_DIA) throw new AppError('Se ha superado el límite de uso del acceso de IA. Inténtelo más tarde.', 429)
  if (!k.ultimo_uso || ahoraMs - new Date(k.ultimo_uso).getTime() > 5 * 60_000) {
    await ejecutar('UPDATE payload_mcp_api_keys SET ultimo_uso = $2 WHERE id = $1', [k.id, ahora()]).catch(() => null)
  }
  return { user, clave: k }
}
