import QRCode from 'qrcode'
import type { PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { dosFactorObligatorio } from '../access'
import { registrar } from '../lib/actividad'
import { cifrar, descifrar } from '../lib/cifrado'
import { nuevoSecreto, uriOtpauth, verificar } from '../lib/totp'

type ConTotp = { id: number | string; email: string; rol?: string | null; totpActivo?: boolean | null; totpSecreto?: string | null; totpPendiente?: string | null; totpUltimoPaso?: number | null }

async function leer(req: PayloadRequest) {
  if (!req.user || req.user.collection !== 'users') throw new APIError('No autenticado.', 401, null, true)
  return (await req.payload.findByID({ collection: 'users', id: req.user.id, showHiddenFields: true, overrideAccess: true, depth: 0, req })) as unknown as ConTotp
}

export async function iniciar2FA(req: PayloadRequest) {
  const u = await leer(req)
  const secreto = nuevoSecreto()
  await req.payload.update({ collection: 'users', id: u.id, data: { totpPendiente: cifrar(secreto) }, overrideAccess: true, req, context: { sinAuditoria: true } })
  const uri = uriOtpauth(secreto, u.email)
  return { secreto, uri, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) }
}

export async function activar2FA(req: PayloadRequest, codigo: string) {
  const u = await leer(req)
  if (!u.totpPendiente) throw new APIError('Inicie primero la configuración del doble factor.', 400, null, true)
  const secreto = descifrar(u.totpPendiente)
  const paso = verificar(secreto, codigo)
  if (!paso) throw new APIError('El código no es correcto. Compruebe la hora del móvil y vuelva a intentarlo.', 400, null, true)
  await req.payload.update({ collection: 'users', id: u.id, data: { totpSecreto: cifrar(secreto), totpPendiente: null, totpActivo: true, totpUltimoPaso: paso }, overrideAccess: true, req, context: { sinAuditoria: true } })
  await registrar(req, { accion: 'seguridad', descripcion: `${u.email} ha activado el doble factor`, coleccion: 'users', registroId: u.id })
}

export async function desactivar2FA(req: PayloadRequest, codigo: string) {
  const u = await leer(req)
  if (u.rol === 'superadmin' && dosFactorObligatorio()) throw new APIError('El doble factor es obligatorio para los super administradores.', 403, null, true)
  if (!u.totpActivo || !u.totpSecreto || !verificar(descifrar(u.totpSecreto), codigo, u.totpUltimoPaso)) throw new APIError('El código no es correcto.', 400, null, true)
  await req.payload.update({ collection: 'users', id: u.id, data: { totpSecreto: null, totpActivo: false, totpUltimoPaso: null }, overrideAccess: true, req, context: { sinAuditoria: true } })
  await registrar(req, { accion: 'seguridad', descripcion: `${u.email} ha desactivado el doble factor`, coleccion: 'users', registroId: u.id })
}

/** Comprobación en el inicio de sesión. Devuelve el paso usado para impedir reutilizar el código. */
export function comprobarCodigoLogin(u: ConTotp, codigo: unknown) {
  if (!u.totpActivo) return null
  if (!u.totpSecreto || typeof codigo !== 'string' || !codigo.trim()) throw new APIError('Introduzca el código de su aplicación de autenticación.', 401, { requiere2fa: true }, true)
  const paso = verificar(descifrar(u.totpSecreto), codigo, u.totpUltimoPaso)
  if (!paso) throw new APIError('El código de verificación no es correcto.', 401, { requiere2fa: true }, true)
  return paso
}
