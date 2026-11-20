import type { Ctx } from './ctx'
import { ahora, ejecutar, jsonParam, jsonSql } from './db'

export const ACCIONES = [
  { label: 'Inicio de sesión', value: 'login' },
  { label: 'Inicio de sesión fallido', value: 'login_fallido' },
  { label: 'Cierre de sesión', value: 'logout' },
  { label: 'Alta', value: 'alta' },
  { label: 'Edición', value: 'edicion' },
  { label: 'Baja', value: 'baja' },
  { label: 'Subida de archivo', value: 'subida' },
  { label: 'Descarga', value: 'descarga' },
  { label: 'Cambio de estado', value: 'cambio_estado' },
  { label: 'Envío a revisión', value: 'envio' },
  { label: 'Publicación', value: 'publicacion' },
  { label: 'Rechazo', value: 'rechazo' },
  { label: 'Mensaje', value: 'mensaje' },
  { label: 'Correo programado', value: 'correo' },
  { label: 'Correo enviado', value: 'correo_enviado' },
  { label: 'Correo entregado', value: 'correo_entregado' },
  { label: 'Correo abierto', value: 'correo_abierto' },
  { label: 'Correo rebotado', value: 'correo_rebotado' },
  { label: 'Correo con error', value: 'correo_error' },
  { label: 'Accesos y permisos', value: 'permisos' },
  { label: 'Seguridad', value: 'seguridad' },
  { label: 'Exportación', value: 'exportacion' },
  { label: 'Consulta desde la web', value: 'consulta' },
] as const

export type Accion = (typeof ACCIONES)[number]['value']

type Evento = {
  accion: Accion
  descripcion: string
  empresa?: number | string | null
  coleccion?: string
  registroId?: number | string | null
  datos?: Record<string, unknown>
  usuario?: { id: number | string; email?: string } | null
}

export const origenDe = (req: Ctx): 'web' | 'mcp' | 'sistema' =>
  req.origen === 'mcp' || req.context?.origen === 'mcp' ? 'mcp' : req.user && req.context?.origen !== 'sistema' && req.origen !== 'sistema' ? 'web' : 'sistema'

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string | null | undefined))

/**
 * Registro de actividad inalterable (RF-20). Nunca interrumpe la operación que lo origina.
 * `aislado`: se escribe fuera de la transacción de la petición (p. ej. un login fallido, que se revierte).
 */
export async function registrar(req: Ctx, e: Evento, _opts: { aislado?: boolean } = {}) {
  const usuario = e.usuario ?? (req.user && req.user.collection === 'users' ? req.user : null)
  const momento = ahora()
  try {
    await ejecutar(
      `INSERT INTO actividad (accion, descripcion, usuario_id, email, empresa_id, origen, coleccion, registro_id, ip, user_agent, datos, updated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, ${jsonSql(11)}, $12, $12)`,
      [
        e.accion,
        e.descripcion.slice(0, 1000),
        usuario?.id ?? null,
        usuario?.email ?? null,
        idDe(e.empresa) || null,
        origenDe(req),
        e.coleccion ?? null,
        e.registroId != null ? String(e.registroId) : null,
        req.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() || req.headers?.get?.('x-real-ip') || null,
        req.headers?.get?.('user-agent')?.slice(0, 300) || null,
        e.datos ? jsonParam(e.datos) : null,
        momento,
      ],
    )
  } catch (err) {
    console.error('No se pudo escribir el registro de actividad', err)
  }
}

const IGNORAR = new Set(['updatedAt', 'createdAt', 'historico', 'loginAttempts', 'lockUntil', 'sessions', 'hash', 'salt', 'resetPasswordToken', 'resetPasswordExpiration', 'totpSecreto', 'totpPendiente', 'totpUltimoPaso', 'password'])

export function cambios(antes: Record<string, unknown> | undefined, despues: Record<string, unknown>) {
  if (!antes) return {}
  const out: Record<string, { antes: unknown; despues: unknown }> = {}
  for (const k of Object.keys(despues)) {
    if (IGNORAR.has(k) || esJoin(antes[k]) || esJoin(despues[k])) continue
    const a = JSON.stringify(normal(antes[k]))
    const d = JSON.stringify(normal(despues[k]))
    if (a !== d) out[k] = { antes: normal(antes[k]), despues: normal(despues[k]) }
  }
  return out
}

/** Los campos «join» son listados calculados, no datos del registro. */
const esJoin = (v: unknown) => Boolean(v && typeof v === 'object' && !Array.isArray(v) && 'docs' in v && 'hasNextPage' in v)

const normal = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(normal)
  if (v && typeof v === 'object') return 'id' in v ? (v as { id: unknown }).id : v
  return v ?? null
}

