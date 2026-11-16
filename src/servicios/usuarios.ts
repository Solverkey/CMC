import type { PayloadRequest } from 'payload'
import { APIError } from 'payload'
import type { Empresa, User } from '@/payload-types'
import { administraEmpresa, esSuperAdmin, rolEn } from '../access'
import { registrar } from '../lib/actividad'
import { crearTokenFirmado, hash, leerTokenFirmado, tokenAleatorio } from '../lib/cifrado'
import { urlServidor } from '../lib/configuracion'
import { programarCorreo } from '../lib/correo'

type Rol = 'admin' | 'usuario'
const idDe = (v: unknown) => String(v && typeof v === 'object' && 'id' in v ? (v as { id: unknown }).id : v)

const membresias = (u: Pick<User, 'empresas'>) => (u.empresas ?? []).map((m) => ({ empresa: idDe(m.empresa), rol: m.rol as Rol }))

export const HORAS_INVITACION = 72

/** Envía la invitación con un enlace de un solo uso para elegir contraseña (72 h). */
export async function enviarInvitacion(req: PayloadRequest, usuario: User, empresa?: Pick<Empresa, 'razonSocial'> | null) {
  const nonce = tokenAleatorio(16)
  await req.payload.update({ collection: 'users', id: usuario.id, data: { invitacionHash: hash(nonce) }, overrideAccess: true, req, context: { sinAuditoria: true } })
  const token = crearTokenFirmado({ u: String(usuario.id), n: nonce }, HORAS_INVITACION * 3600, 'invitacion')
  await programarCorreo(req, {
    plantilla: 'invitacion',
    para: [{ email: usuario.email, usuario: usuario.id, tipo: usuario.rol === 'superadmin' ? 'cmc' : 'cliente' }],
    vars: { nombre: usuario.nombre, empresa: empresa?.razonSocial ?? 'CMC' },
    enlace: `${urlServidor()}/portal/restablecer?invitacion=${encodeURIComponent(token)}`,
    sensible: true,
  })
}

/** Acepta la invitación: fija la contraseña y anula el enlace. */
export async function aceptarInvitacion(req: PayloadRequest, token: string, password: string) {
  const datos = leerTokenFirmado<{ u: string; n: string }>(token, 'invitacion')
  if (!datos) throw new APIError('El enlace de invitación no es válido o ha caducado. Pida a su administrador que se lo reenvíe.', 400, null, true)
  const u = (await req.payload.findByID({ collection: 'users', id: datos.u, overrideAccess: true, showHiddenFields: true, depth: 0, req }).catch(() => null)) as (User & { invitacionHash?: string }) | null
  if (!u || !u.invitacionHash || u.invitacionHash !== hash(datos.n)) throw new APIError('Este enlace ya se ha utilizado.', 400, null, true)
  validarPassword(password)
  await req.payload.update({ collection: 'users', id: u.id, data: { password, invitacionHash: null, activo: true }, overrideAccess: true, req })
  await registrar(req, { accion: 'seguridad', descripcion: `${u.email} ha aceptado la invitación`, usuario: u, coleccion: 'users', registroId: u.id })
  return u
}

export function validarPassword(password: string) {
  if (typeof password !== 'string' || password.length < 10) throw new APIError('La contraseña debe tener al menos 10 caracteres.', 400, null, true)
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) throw new APIError('La contraseña debe combinar letras y números.', 400, null, true)
}

/**
 * Alta de usuario en una empresa (RF-04). Si el email ya existe, se le añade la empresa en lugar de crear
 * otro usuario. Un administrador de empresa solo puede dar acceso a las empresas que administra y nunca con
 * un rol superior al suyo.
 */
export async function invitarUsuario(req: PayloadRequest, { email, nombre, empresa, rol }: { email: string; nombre?: string; empresa: string | number; rol: Rol }) {
  if (!administraEmpresa(req.user, empresa)) throw new APIError('Solo puede dar acceso a las empresas que administra.', 403, null, true)
  if (!['admin', 'usuario'].includes(rol)) throw new APIError('Rol no válido.', 400, null, true)
  const emp = (await req.payload.findByID({ collection: 'empresas', id: empresa, depth: 0, overrideAccess: true, req })) as Empresa
  if (!emp.activa) throw new APIError('La empresa está dada de baja.', 400, null, true)
  const limpio = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) throw new APIError('Email no válido.', 400, null, true)

  const { docs } = await req.payload.find({ collection: 'users', where: { email: { equals: limpio } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true, req })
  const existente = docs[0] as User | undefined
  if (existente) {
    if (existente.rol === 'superadmin') throw new APIError('Ese email pertenece a CMC.', 400, null, true)
    const actuales = membresias(existente)
    if (actuales.some((m) => m.empresa === String(empresa))) throw new APIError('Ese usuario ya tiene acceso a esta empresa.', 400, null, true)
    const actualizado = (await req.payload.update({
      collection: 'users',
      id: existente.id,
      data: { empresas: [...actuales, { empresa: String(empresa), rol }].map((m) => ({ empresa: Number(m.empresa), rol: m.rol })), activo: true },
      overrideAccess: true,
      req,
    })) as User
    await registrar(req, { accion: 'permisos', descripcion: `Acceso a «${emp.razonSocial}» como ${rol === 'admin' ? 'administrador' : 'usuario'} para ${limpio}`, empresa, coleccion: 'users', registroId: existente.id })
    if (existente.invitacionHash || !existente.activo) await enviarInvitacion(req, actualizado, emp)
    else
      await programarCorreo(req, {
        plantilla: 'acceso_empresa',
        para: [{ email: limpio, usuario: existente.id, tipo: 'cliente' }],
        vars: { nombre: existente.nombre, empresa: emp.razonSocial },
        enlace: `${urlServidor()}/portal?empresa=${emp.id}`,
        empresa: emp.id,
      })
    return { usuario: actualizado, creado: false }
  }

  const usuario = (await req.payload.create({
    collection: 'users',
    data: { email: limpio, nombre: nombre?.trim() || limpio, rol: 'cliente', password: tokenAleatorio(24), empresas: [{ empresa: Number(empresa) || (empresa as number), rol }], activo: true },
    overrideAccess: true,
    req,
    context: { sinInvitacion: true },
  })) as User
  await registrar(req, { accion: 'permisos', descripcion: `Alta de ${limpio} en «${emp.razonSocial}» como ${rol === 'admin' ? 'administrador' : 'usuario'}`, empresa, coleccion: 'users', registroId: usuario.id })
  await enviarInvitacion(req, usuario, emp)
  return { usuario, creado: true }
}

async function administradoresActivos(req: PayloadRequest, empresa: string, excepto?: string) {
  const { docs } = await req.payload.find({ collection: 'users', where: { and: [{ 'empresas.empresa': { equals: empresa } }, { activo: { not_equals: false } }] }, limit: 1000, depth: 0, overrideAccess: true, req })
  return (docs as User[]).filter((u) => String(u.id) !== excepto && membresias(u).some((m) => m.empresa === empresa && m.rol === 'admin'))
}

/** Cada empresa debe tener siempre al menos un administrador activo. */
export async function comprobarAdministradores(req: PayloadRequest, antes: User | undefined, despues: { empresas: { empresa: string; rol: Rol }[]; activo: boolean }) {
  if (!antes) return
  for (const m of membresias(antes).filter((x) => x.rol === 'admin')) {
    const sigue = despues.activo && despues.empresas.some((x) => x.empresa === m.empresa && x.rol === 'admin')
    if (sigue) continue
    const otros = await administradoresActivos(req, m.empresa, String(antes.id))
    if (!otros.length) {
      const emp = await req.payload.findByID({ collection: 'empresas', id: m.empresa, depth: 0, overrideAccess: true, req }).catch(() => null)
      if (emp && emp.activa) throw new APIError(`«${emp.razonSocial}» debe tener al menos un administrador activo. Nombre otro antes de quitar este.`, 400, null, true)
    }
  }
}

/** Retira solo el acceso a esa empresa. Si el usuario se queda sin empresas, se da de baja. */
export async function quitarAcceso(req: PayloadRequest, { usuario, empresa }: { usuario: string | number; empresa: string | number }) {
  if (!administraEmpresa(req.user, empresa)) throw new APIError('Solo puede gestionar los usuarios de las empresas que administra.', 403, null, true)
  const u = (await req.payload.findByID({ collection: 'users', id: usuario, depth: 0, overrideAccess: true, req })) as User
  const restantes = membresias(u).filter((m) => m.empresa !== String(empresa))
  if (restantes.length === membresias(u).length) throw new APIError('Ese usuario no tiene acceso a esta empresa.', 400, null, true)
  const actualizado = await req.payload.update({
    collection: 'users',
    id: u.id,
    data: { empresas: restantes.map((m) => ({ empresa: Number(m.empresa) || (m.empresa as unknown as number), rol: m.rol })), ...(restantes.length || u.rol === 'superadmin' ? {} : { activo: false }) },
    overrideAccess: true,
    req,
  })
  await registrar(req, { accion: 'permisos', descripcion: `Retirado el acceso de ${u.email} a la empresa ${empresa}${restantes.length ? '' : ' (baja total: sin empresas)'}`, empresa, coleccion: 'users', registroId: u.id })
  return actualizado
}

export async function cambiarRol(req: PayloadRequest, { usuario, empresa, rol }: { usuario: string | number; empresa: string | number; rol: Rol }) {
  if (!administraEmpresa(req.user, empresa)) throw new APIError('Solo puede gestionar los usuarios de las empresas que administra.', 403, null, true)
  if (!esSuperAdmin(req.user) && rol === 'admin' && rolEn(req.user, empresa) !== 'admin') throw new APIError('No puede asignar un rol superior al suyo.', 403, null, true)
  const u = (await req.payload.findByID({ collection: 'users', id: usuario, depth: 0, overrideAccess: true, req })) as User
  const actuales = membresias(u)
  if (!actuales.some((m) => m.empresa === String(empresa))) throw new APIError('Ese usuario no tiene acceso a esta empresa.', 400, null, true)
  const nuevas = actuales.map((m) => (m.empresa === String(empresa) ? { ...m, rol } : m))
  const actualizado = await req.payload.update({ collection: 'users', id: u.id, data: { empresas: nuevas.map((m) => ({ empresa: Number(m.empresa) || (m.empresa as unknown as number), rol: m.rol })) }, overrideAccess: true, req })
  await registrar(req, { accion: 'permisos', descripcion: `${u.email} pasa a ser ${rol === 'admin' ? 'administrador' : 'usuario'} de la empresa ${empresa}`, empresa, coleccion: 'users', registroId: u.id })
  return actualizado
}

/** Usuarios de una empresa visibles para quien la administra. */
export async function usuariosDeEmpresa(req: PayloadRequest, empresa: string | number) {
  if (!administraEmpresa(req.user, empresa)) throw new APIError('No administra esta empresa.', 403, null, true)
  const { docs } = await req.payload.find({ collection: 'users', where: { 'empresas.empresa': { equals: empresa } }, limit: 1000, depth: 0, sort: 'nombre', overrideAccess: true, showHiddenFields: true, req })
  return (docs as User[]).map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    activo: u.activo !== false,
    pendiente: Boolean(u.invitacionHash),
    rol: membresias(u).find((m) => m.empresa === String(empresa))?.rol ?? 'usuario',
  }))
}
