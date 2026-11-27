import crypto from 'crypto'
import { administraEmpresa, esSuperAdmin, rolEn } from '@/access'
import { AppError } from '@/lib/appError'
import { registrar } from '@/lib/actividad'
import { crearTokenFirmado, hash, leerTokenFirmado, tokenAleatorio } from '@/lib/cifrado'
import { ctxSistema, type Ctx } from '@/lib/ctx'
import { verificarPassword } from '@/lib/clave'
import { urlServidor } from '@/lib/configuracion'
import { programarCorreo } from '@/lib/correo'
import { ahora, bit, ejecutar, filas, uno } from '@/lib/db'
import { cerrarOtrasSesiones, guardarPassword, usuarioPorEmail, usuarioPorId } from '@/datos/usuarios'
import { empresaPorId } from '@/datos/consultas'
import type { Empresa, User } from '@/datos/tipos'

type Rol = 'admin' | 'usuario'
const idDe = (v: unknown) => String(v && typeof v === 'object' && 'id' in v ? (v as { id: unknown }).id : v)
const membresias = (u: Pick<User, 'empresas'>) => (u.empresas ?? []).map((m) => ({ empresa: idDe(m.empresa), rol: m.rol as Rol }))

export const HORAS_INVITACION = 72

async function ponerEmpresas(userId: number, lista: { empresa: string; rol: Rol }[]) {
  await ejecutar('DELETE FROM users_empresas WHERE _parent_id = $1', [userId])
  let orden = 1
  for (const m of lista) {
    await ejecutar('INSERT INTO users_empresas (id, _order, _parent_id, empresa_id, rol) VALUES ($1,$2,$3,$4,$5)', [crypto.randomUUID(), orden++, userId, Number(m.empresa), m.rol])
  }
}

export async function enviarInvitacion(req: Ctx, usuario: User, empresa?: Pick<Empresa, 'razonSocial'> | null) {
  const nonce = tokenAleatorio(16)
  await ejecutar('UPDATE users SET invitacion_hash = $2, updated_at = $3 WHERE id = $1', [usuario.id, hash(nonce), ahora()])
  const token = crearTokenFirmado({ u: String(usuario.id), n: nonce }, HORAS_INVITACION * 3600, 'invitacion')
  await programarCorreo(req, {
    plantilla: 'invitacion',
    para: [{ email: usuario.email, usuario: usuario.id, tipo: usuario.rol === 'superadmin' ? 'cmc' : 'cliente' }],
    vars: { nombre: usuario.nombre, empresa: empresa?.razonSocial ?? 'CMC' },
    enlace: `${urlServidor()}/portal/restablecer?invitacion=${encodeURIComponent(token)}`,
    sensible: true,
  })
}

export async function aceptarInvitacion(req: Ctx, token: string, password: string) {
  const datos = leerTokenFirmado<{ u: string; n: string }>(token, 'invitacion')
  if (!datos) throw new AppError('El enlace de invitación no es válido o ha caducado. Pida a su administrador que se lo reenvíe.', 400)
  const u = await usuarioPorId(datos.u, true)
  if (!u || !u.invitacionHash || u.invitacionHash !== hash(datos.n)) throw new AppError('Este enlace ya se ha utilizado.', 400)
  validarPassword(password)
  await guardarPassword(u.id, password)
  await registrar(req, { accion: 'seguridad', descripcion: `${u.email} ha aceptado la invitación`, usuario: u, coleccion: 'users', registroId: u.id })
  return u
}

export function validarPassword(password: string) {
  if (typeof password !== 'string' || password.length < 10) throw new AppError('La contraseña debe tener al menos 10 caracteres.', 400)
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) throw new AppError('La contraseña debe combinar letras y números.', 400)
}

export async function invitarUsuario(req: Ctx, { email, nombre, empresa, rol }: { email: string; nombre?: string; empresa: string | number; rol: Rol }) {
  if (!administraEmpresa(req.user, empresa)) throw new AppError('Solo puede dar acceso a las empresas que administra.', 403)
  if (!['admin', 'usuario'].includes(rol)) throw new AppError('Rol no válido.', 400)
  const emp = await empresaPorId(empresa)
  if (!emp?.activa) throw new AppError('La empresa está dada de baja.', 400)
  const limpio = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) throw new AppError('Email no válido.', 400)

  const existente = await usuarioPorEmail(limpio, true)
  if (existente) {
    if (existente.rol === 'superadmin') throw new AppError('Ese email pertenece a CMC.', 400)
    const actuales = membresias(existente)
    if (actuales.some((m) => m.empresa === String(empresa))) throw new AppError('Ese usuario ya tiene acceso a esta empresa.', 400)
    await ponerEmpresas(existente.id, [...actuales, { empresa: String(empresa), rol }])
    await ejecutar('UPDATE users SET activo = $2, updated_at = $3 WHERE id = $1', [existente.id, bit(true), ahora()])
    const actualizado = (await usuarioPorId(existente.id))!
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

  const momento = ahora()
  const provisional = await import('@/lib/clave').then((m) => m.crearHashPassword(tokenAleatorio(24)))
  const creado = await uno<{ id: number }>(
    `INSERT INTO users (nombre, rol, email, hash, salt, activo, recibe_avisos, updated_at, created_at) VALUES ($1,'cliente',$2,$3,$4,$5,$6,$7,$7) RETURNING id`,
    [nombre?.trim() || limpio, limpio, provisional.hash, provisional.salt, bit(true), bit(false), momento],
  )
  await ponerEmpresas(creado!.id, [{ empresa: String(empresa), rol }])
  const usuario = (await usuarioPorId(creado!.id))!
  await registrar(req, { accion: 'permisos', descripcion: `Alta de ${limpio} en «${emp.razonSocial}» como ${rol === 'admin' ? 'administrador' : 'usuario'}`, empresa, coleccion: 'users', registroId: usuario.id })
  await enviarInvitacion(req, usuario, emp)
  return { usuario, creado: true }
}

async function administradoresActivos(empresa: string, excepto?: string) {
  const rows = await filas<{ id: number }>('SELECT _parent_id AS id FROM users_empresas WHERE empresa_id = $1 AND rol = $2', [Number(empresa), 'admin'])
  const activos = []
  for (const r of rows) {
    if (String(r.id) === excepto) continue
    const u = await usuarioPorId(r.id)
    if (u && u.activo !== false) activos.push(u)
  }
  return activos
}

export async function comprobarAdministradores(_req: Ctx, antes: User | undefined, despues: { empresas: { empresa: string; rol: Rol }[]; activo: boolean }) {
  if (!antes) return
  for (const m of membresias(antes).filter((x) => x.rol === 'admin')) {
    const sigue = despues.activo && despues.empresas.some((x) => x.empresa === m.empresa && x.rol === 'admin')
    if (sigue) continue
    const otros = await administradoresActivos(m.empresa, String(antes.id))
    if (!otros.length) {
      const emp = await empresaPorId(m.empresa)
      if (emp?.activa) throw new AppError(`«${emp.razonSocial}» debe tener al menos un administrador activo. Nombre otro antes de quitar este.`, 400)
    }
  }
}

export async function quitarAcceso(req: Ctx, { usuario, empresa }: { usuario: string | number; empresa: string | number }) {
  if (!administraEmpresa(req.user, empresa)) throw new AppError('Solo puede gestionar los usuarios de las empresas que administra.', 403)
  const u = await usuarioPorId(usuario)
  if (!u) throw new AppError('Usuario no encontrado.', 404)
  const restantes = membresias(u).filter((m) => m.empresa !== String(empresa))
  if (restantes.length === membresias(u).length) throw new AppError('Ese usuario no tiene acceso a esta empresa.', 400)
  await comprobarAdministradores(req, u, { empresas: restantes, activo: restantes.length > 0 || u.rol === 'superadmin' })
  await ponerEmpresas(u.id, restantes)
  if (!restantes.length && u.rol !== 'superadmin') await ejecutar('UPDATE users SET activo = $2, updated_at = $3 WHERE id = $1', [u.id, bit(false), ahora()])
  await registrar(req, { accion: 'permisos', descripcion: `Retirado el acceso de ${u.email} a la empresa ${empresa}${restantes.length ? '' : ' (baja total: sin empresas)'}`, empresa, coleccion: 'users', registroId: u.id })
  return usuarioPorId(u.id)
}

export async function cambiarRol(req: Ctx, { usuario, empresa, rol }: { usuario: string | number; empresa: string | number; rol: Rol }) {
  if (!administraEmpresa(req.user, empresa)) throw new AppError('Solo puede gestionar los usuarios de las empresas que administra.', 403)
  if (!esSuperAdmin(req.user) && rol === 'admin' && rolEn(req.user, empresa) !== 'admin') throw new AppError('No puede asignar un rol superior al suyo.', 403)
  const u = await usuarioPorId(usuario)
  if (!u) throw new AppError('Usuario no encontrado.', 404)
  const actuales = membresias(u)
  if (!actuales.some((m) => m.empresa === String(empresa))) throw new AppError('Ese usuario no tiene acceso a esta empresa.', 400)
  const nuevas = actuales.map((m) => (m.empresa === String(empresa) ? { ...m, rol } : m))
  await comprobarAdministradores(req, u, { empresas: nuevas, activo: u.activo !== false })
  await ponerEmpresas(u.id, nuevas)
  await registrar(req, { accion: 'permisos', descripcion: `${u.email} pasa a ser ${rol === 'admin' ? 'administrador' : 'usuario'} de la empresa ${empresa}`, empresa, coleccion: 'users', registroId: u.id })
  return usuarioPorId(u.id)
}

export async function usuariosDeEmpresa(req: Ctx, empresa: string | number) {
  if (!administraEmpresa(req.user, empresa)) throw new AppError('No administra esta empresa.', 403)
  const rows = await filas<{ id: number }>('SELECT _parent_id AS id FROM users_empresas WHERE empresa_id = $1', [Number(empresa)])
  const salida = []
  for (const r of rows) {
    const u = await usuarioPorId(r.id, true)
    if (!u) continue
    salida.push({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      activo: u.activo !== false,
      pendiente: Boolean(u.invitacionHash),
      rol: membresias(u).find((m) => m.empresa === String(empresa))?.rol ?? 'usuario',
    })
  }
  return salida.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export async function pedirRestablecer(email: string) {
  const u = await usuarioPorEmail(email, true)
  if (!u || u.activo === false) return
  const token = tokenAleatorio(24)
  const expira = new Date(Date.now() + 60 * 60 * 1000).toISOString()
  await ejecutar('UPDATE users SET reset_password_token = $2, reset_password_expiration = $3, reset_password_requested_at = $4, updated_at = $4 WHERE id = $1', [u.id, hash(token), expira, ahora()])
  const cfg = await (await import('@/lib/configuracion')).leerConfiguracion()
  const t = cfg.plantilla('recuperar_password')
  await programarCorreo({ user: null, headers: new Headers(), origen: 'sistema', context: { origen: 'sistema' } }, {
    plantilla: 'recuperar_password',
    asunto: t.asunto,
    cuerpo: t.cuerpo,
    para: [{ email: u.email, usuario: u.id, tipo: u.rol === 'superadmin' ? 'cmc' : 'cliente' }],
    vars: { nombre: u.nombre },
    enlace: `${urlServidor()}/portal/restablecer?token=${token}`,
    sensible: true,
  })
}

export async function restablecerPassword(token: string, password: string) {
  validarPassword(password)
  const u = await uno<{ id: number; reset_password_token: string | null; reset_password_expiration: string | null; email: string }>('SELECT id, reset_password_token, reset_password_expiration, email FROM users WHERE reset_password_token = $1', [hash(token)])
  if (!u || !u.reset_password_expiration || new Date(u.reset_password_expiration) < new Date()) throw new AppError('El enlace no es válido o ha caducado.', 400)
  await guardarPassword(u.id, password)
  // Quien tuviera la contraseña anterior deja de tener acceso.
  await cerrarOtrasSesiones(u.id)
  await registrar(ctxSistema(), { accion: 'seguridad', descripcion: `${u.email} ha restablecido su contraseña`, usuario: { id: u.id, email: u.email }, coleccion: 'users', registroId: u.id })
}

/** Cambio de la contraseña propia: pide la actual, cierra las demás sesiones y queda registrado. */
export async function cambiarPassword(req: Ctx, sesionActual: string | null, actual: string, nueva: string) {
  if (!req.user) throw new AppError('No autenticado.', 401)
  const u = await usuarioPorId(req.user.id, true)
  if (!u?.hash || !u.salt || !(await verificarPassword(actual, u.hash, u.salt))) throw new AppError('La contraseña actual no es correcta.', 400)
  validarPassword(nueva)
  if (actual === nueva) throw new AppError('La nueva contraseña debe ser distinta de la actual.', 400)
  await guardarPassword(u.id, nueva)
  await cerrarOtrasSesiones(u.id, sesionActual)
  await registrar(req, { accion: 'seguridad', descripcion: `${u.email} ha cambiado su contraseña (se han cerrado sus otras sesiones)`, coleccion: 'users', registroId: u.id })
}

// ——— Equipo de CMC (super administradores) ———

const soloCmc = (req: Ctx) => {
  if (!esSuperAdmin(req.user)) throw new AppError('Solo CMC puede gestionar su equipo.', 403)
}

/** Personas de CMC con su estado, doble factor, si reciben avisos y su último acceso. */
export async function equipoCmc(req: Ctx) {
  soloCmc(req)
  const rows = await filas<Record<string, unknown>>(
    `SELECT u.id, u.nombre, u.email, u.activo, u.totp_activo, u.recibe_avisos, u.invitacion_hash,
            (SELECT MAX(a.created_at) FROM actividad a WHERE a.usuario_id = u.id AND a.accion = 'login') AS ultimo
       FROM users u WHERE u.rol = 'superadmin' ORDER BY u.nombre`,
  )
  const si = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true'
  return rows.map((r) => ({
    id: Number(r.id),
    nombre: String(r.nombre ?? ''),
    email: String(r.email ?? ''),
    activo: r.activo == null ? true : si(r.activo),
    dobleFactor: si(r.totp_activo),
    recibeAvisos: si(r.recibe_avisos),
    pendiente: Boolean(r.invitacion_hash),
    ultimoAcceso: r.ultimo ? String(r.ultimo) : null,
  }))
}

/** Invita a una persona nueva al equipo de CMC. Al entrar tendrá que activar el doble factor. */
export async function invitarCmc(req: Ctx, { email, nombre }: { email: string; nombre?: string }) {
  soloCmc(req)
  const limpio = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) throw new AppError('Email no válido.', 400)
  if (await usuarioPorEmail(limpio, true)) throw new AppError('Ya existe una cuenta con ese email. Una cuenta de cliente no puede ser también de CMC.', 400)
  const provisional = await import('@/lib/clave').then((m) => m.crearHashPassword(tokenAleatorio(24)))
  const creado = await uno<{ id: number }>(
    `INSERT INTO users (nombre, rol, email, hash, salt, activo, recibe_avisos, updated_at, created_at) VALUES ($1,'superadmin',$2,$3,$4,$5,$6,$7,$7) RETURNING id`,
    [nombre?.trim() || limpio, limpio, provisional.hash, provisional.salt, bit(true), bit(true), ahora()],
  )
  const usuario = (await usuarioPorId(creado!.id))!
  await registrar(req, { accion: 'permisos', descripcion: `Alta de ${limpio} en el equipo de CMC`, coleccion: 'users', registroId: usuario.id })
  await enviarInvitacion(req, usuario, null)
  return usuario
}

/** Activa o desactiva a una persona de CMC, o decide si recibe los avisos internos. Nunca a uno mismo ni al último activo. */
export async function cambiarEquipoCmc(req: Ctx, id: number | string, cambios: { activo?: boolean; recibeAvisos?: boolean }) {
  soloCmc(req)
  const u = await usuarioPorId(id, true)
  if (!u || u.rol !== 'superadmin') throw new AppError('Esa persona no es del equipo de CMC.', 404)
  if (cambios.activo === false) {
    if (String(u.id) === String(req.user!.id)) throw new AppError('No puede desactivar su propia cuenta.', 400)
    const activos = await filas<{ id: number }>(`SELECT id FROM users WHERE rol = 'superadmin' AND (activo IS NULL OR activo IS NOT FALSE) AND id <> $1`, [u.id])
    if (!activos.length) throw new AppError('Debe quedar al menos una persona activa en CMC.', 400)
    await ejecutar('UPDATE users SET activo = $2, updated_at = $3 WHERE id = $1', [u.id, bit(false), ahora()])
    // Fuera: sus sesiones y sus accesos de IA dejan de valer.
    await cerrarOtrasSesiones(u.id)
    await ejecutar('DELETE FROM payload_mcp_api_keys WHERE user_id = $1', [u.id])
    await registrar(req, { accion: 'baja', descripcion: `${u.email} desactivado del equipo de CMC (sesiones y accesos de IA cerrados)`, coleccion: 'users', registroId: u.id })
  } else if (cambios.activo === true) {
    await ejecutar('UPDATE users SET activo = $2, updated_at = $3 WHERE id = $1', [u.id, bit(true), ahora()])
    await registrar(req, { accion: 'alta', descripcion: `${u.email} reactivado en el equipo de CMC`, coleccion: 'users', registroId: u.id })
  }
  if (cambios.recibeAvisos !== undefined) {
    await ejecutar('UPDATE users SET recibe_avisos = $2, updated_at = $3 WHERE id = $1', [u.id, bit(cambios.recibeAvisos), ahora()])
    await registrar(req, { accion: 'edicion', descripcion: `${u.email} ${cambios.recibeAvisos ? 'recibe' : 'deja de recibir'} los avisos internos de CMC`, coleccion: 'users', registroId: u.id })
  }
}
