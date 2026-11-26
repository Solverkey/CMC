import QRCode from 'qrcode'
import { dosFactorObligatorio } from '@/access'
import { AppError } from '@/lib/appError'
import { registrar } from '@/lib/actividad'
import { cifrar, descifrar } from '@/lib/cifrado'
import type { Ctx } from '@/lib/ctx'
import { ahora, bit, ejecutar } from '@/lib/db'
import { usuarioPorId } from '@/datos/usuarios'
import { nuevoSecreto, uriOtpauth, verificar } from '@/lib/totp'

async function leer(req: Ctx) {
  if (!req.user) throw new AppError('No autenticado.', 401)
  const u = await usuarioPorId(req.user.id, true)
  if (!u) throw new AppError('No autenticado.', 401)
  return u
}

export async function iniciar2FA(req: Ctx, codigoActual?: string) {
  const u = await leer(req)
  // Con el doble factor ya activo, cambiar de aplicación exige un código de la actual: una sesión robada no basta.
  if (u.totpActivo && (!u.totpSecreto || !codigoActual || !verificar(descifrar(u.totpSecreto), codigoActual, u.totpUltimoPaso))) {
    throw new AppError('Para cambiar de aplicación indique un código de la que usa ahora.', 400)
  }
  const secreto = nuevoSecreto()
  await ejecutar('UPDATE users SET totp_pendiente = $2, updated_at = $3 WHERE id = $1', [u.id, cifrar(secreto), ahora()])
  const uri = uriOtpauth(secreto, u.email)
  return { secreto, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) }
}

export async function activar2FA(req: Ctx, codigo: string) {
  const u = await leer(req)
  if (!u.totpPendiente) throw new AppError('Inicie primero la configuración del doble factor.', 400)
  const secreto = descifrar(u.totpPendiente)
  const paso = verificar(secreto, codigo)
  if (!paso) throw new AppError('El código no es correcto. Compruebe la hora del móvil y vuelva a intentarlo.', 400)
  await ejecutar('UPDATE users SET totp_secreto = $2, totp_pendiente = NULL, totp_activo = $3, totp_ultimo_paso = $4, updated_at = $5 WHERE id = $1', [u.id, cifrar(secreto), bit(true), paso, ahora()])
  await registrar(req, { accion: 'seguridad', descripcion: `${u.email} ha activado el doble factor`, coleccion: 'users', registroId: u.id })
}

export async function desactivar2FA(req: Ctx, codigo: string) {
  const u = await leer(req)
  if (u.rol === 'superadmin' && dosFactorObligatorio()) throw new AppError('El doble factor es obligatorio para los super administradores.', 403)
  if (!u.totpActivo || !u.totpSecreto || !verificar(descifrar(u.totpSecreto), codigo, u.totpUltimoPaso)) throw new AppError('El código no es correcto.', 400)
  await ejecutar('UPDATE users SET totp_secreto = NULL, totp_activo = $2, totp_ultimo_paso = NULL, updated_at = $3 WHERE id = $1', [u.id, bit(false), ahora()])
  await registrar(req, { accion: 'seguridad', descripcion: `${u.email} ha desactivado el doble factor`, coleccion: 'users', registroId: u.id })
}

export function comprobarCodigoLogin(u: { totpActivo?: boolean | null; totpSecreto?: string | null; totpUltimoPaso?: number | null }, codigo: unknown) {
  if (!u.totpActivo) return null
  if (!u.totpSecreto || typeof codigo !== 'string' || !codigo.trim()) throw new AppError('Introduzca el código de su aplicación de autenticación.', 401, { requiere2fa: true })
  const paso = verificar(descifrar(u.totpSecreto), codigo, u.totpUltimoPaso)
  if (!paso) throw new AppError('El código de verificación no es correcto.', 401, { requiere2fa: true })
  return paso
}
