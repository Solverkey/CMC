import { headers } from 'next/headers'
import path from 'path'
import { esSuperAdmin } from '@/access'
import { visible } from '@/datos/mapas'
import { registrar } from '@/lib/actividad'
import { AppError, errorJson } from '@/lib/appError'
import { sugerir } from '@/lib/catalogo'
import { firmar, igualSeguro } from '@/lib/cifrado'
import type { Ctx } from '@/lib/ctx'
import { ahora, ejecutar, uno } from '@/lib/db'
import { leerFichero, tipoPorNombre } from '@/lib/ficheros'
import { verificarPassword } from '@/lib/clave'
import { leerSesion, escribirSesion, borrarSesion } from '@/lib/sesion'
import { anotarFallo, guardarPassword, usuarioPorEmail } from '@/datos/usuarios'
import { crearEnvio } from '@/datos/operaciones'
import { autorizar, cuerpo, metadatosRecurso, metadatosServidor, registrarCliente, revocar, token } from '@/mcp/oauth'
import { adjuntoAEnvio, crearHilo, escribirMensaje, exportarHistorial, subirAdjunto } from '@/servicios/comunicacion'
import { descargable, inventario, resolverEnlace, zipDocumentos } from '@/servicios/documentos'
import { activar2FA, comprobarCodigoLogin, desactivar2FA, iniciar2FA } from '@/servicios/seguridad'
import { aceptarInvitacion, pedirRestablecer, restablecerPassword, validarPassword } from '@/servicios/usuarios'

export const dynamic = 'force-dynamic'

const PUBLICOS = new Set(['media', 'videos'])
const PRIVADOS = new Set(['archivos', 'envios', 'adjuntos', 'originales'])

const json = (datos: unknown, status = 200) => Response.json(datos, { status })

async function ctxDe(origen: Ctx['origen'] = 'web'): Promise<Ctx> {
  return { user: await leerSesion(), headers: await headers(), origen, context: {} }
}

const exigir = (ctx: Ctx) => {
  if (!ctx.user) throw new AppError('No autenticado.', 401)
  return ctx.user
}

async function formulario(req: Request) {
  const tipo = req.headers.get('content-type') ?? ''
  if (!tipo.includes('multipart/form-data') && !tipo.includes('application/x-www-form-urlencoded')) {
    throw new AppError('Hay que enviar el formulario con el archivo.', 400)
  }
  return req.formData()
}

async function ficheroDe(file: FormDataEntryValue | null) {
  if (!(file instanceof File) || file.size === 0) throw new AppError('Adjunte el archivo.', 400)
  return { data: Buffer.from(await file.arrayBuffer()), mimetype: file.type || 'application/octet-stream', name: file.name, size: file.size }
}

async function login(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { email?: string; password?: string; codigo?: string }
  const u = b.email ? await usuarioPorEmail(b.email, true) : null
  if (!u?.hash || !u.salt) throw new AppError('Correo o contraseña incorrectos.', 401)
  if (u.lockUntil && new Date(u.lockUntil) > new Date()) throw new AppError('La cuenta está bloqueada 15 minutos por intentos fallidos.', 403)
  const ctxLogin: Ctx = { user: u, headers: req.headers, origen: 'web', context: {} }
  if (!(await verificarPassword(String(b.password ?? ''), u.hash, u.salt))) {
    await anotarFallo(u.id)
    await registrar(ctxLogin, { accion: 'login_fallido', descripcion: `Intento fallido de ${u.email}`, usuario: u })
    throw new AppError('Correo o contraseña incorrectos.', 401)
  }
  if (u.activo === false) throw new AppError('Esta cuenta está dada de baja.', 403)
  let paso: number | null
  try {
    paso = comprobarCodigoLogin(u, b.codigo)
  } catch (e) {
    // Un código erróneo cuenta como intento fallido: si no, el doble factor se podría probar sin límite.
    if (typeof b.codigo === 'string' && b.codigo.trim()) {
      await anotarFallo(u.id)
      await registrar(ctxLogin, { accion: 'login_fallido', descripcion: `Código de doble factor incorrecto de ${u.email}`, usuario: u })
    }
    throw e
  }
  if (u.rol !== 'superadmin' && !(u.empresas ?? []).some((m) => typeof m.empresa === 'object' && m.empresa.activa !== false)) {
    throw new AppError('No tiene ninguna empresa activa.', 403)
  }
  if (paso) await ejecutar('UPDATE users SET totp_ultimo_paso = $2, updated_at = $3 WHERE id = $1', [u.id, paso, ahora()])
  await escribirSesion(u.id)
  await registrar(ctxLogin, { accion: 'login', descripcion: `Inicio de sesión de ${u.email}`, usuario: u })
  return json({ user: { id: u.id, email: u.email } })
}

function archivo(data: Buffer, nombre: string, mime: string) {
  return descargable({ data, nombre, mime })
}

async function atender(req: Request, slug: string[]) {
  const ruta = slug.join('/')
  const ctx = await ctxDe()

  if (req.method === 'GET' && ruta === '.well-known/oauth-authorization-server') return json(metadatosServidor())
  if (req.method === 'GET' && ruta === '.well-known/oauth-protected-resource') return json(metadatosRecurso())

  if (req.method === 'POST' && ruta === 'users/login') return login(req)
  if (req.method === 'POST' && ruta === 'users/logout') {
    if (ctx.user) await registrar(ctx, { accion: 'logout', descripcion: `Cierre de sesión de ${ctx.user.email}` })
    await borrarSesion()
    return json({ ok: true })
  }
  if (req.method === 'POST' && ruta === 'users/forgot-password') {
    const b = (await req.json().catch(() => ({}))) as { email?: string }
    await pedirRestablecer(String(b.email ?? '')).catch(() => null)
    return json({ ok: true })
  }
  if (req.method === 'POST' && ruta === 'users/reset-password') {
    const b = (await req.json()) as { token?: string; password?: string }
    await restablecerPassword(String(b.token ?? ''), String(b.password ?? ''))
    return json({ ok: true })
  }
  if (req.method === 'POST' && ruta === 'users/aceptar-invitacion') {
    const b = (await req.json()) as { token?: string; password?: string }
    await aceptarInvitacion(ctx, String(b.token ?? ''), String(b.password ?? ''))
    return json({ ok: true })
  }
  if (req.method === 'POST' && ruta === 'users/2fa/iniciar') return json(await iniciar2FA(ctx))
  if (req.method === 'POST' && ruta === 'users/2fa/activar') {
    const b = (await req.json()) as { codigo?: string }
    await activar2FA(ctx, String(b.codigo ?? ''))
    return json({ ok: true })
  }
  if (req.method === 'POST' && ruta === 'users/2fa/desactivar') {
    const b = (await req.json()) as { codigo?: string }
    await desactivar2FA(ctx, String(b.codigo ?? ''))
    return json({ ok: true })
  }
  if (req.method === 'PATCH' && slug[0] === 'users' && slug.length === 2) {
    const yo = exigir(ctx)
    if (String(yo.id) !== slug[1]) throw new AppError('No puede cambiar la contraseña de otra cuenta.', 403)
    const b = (await req.json()) as { password?: string }
    validarPassword(String(b.password ?? ''))
    await guardarPassword(yo.id, String(b.password))
    return json({ ok: true })
  }

  if (req.method === 'POST' && ruta === 'oauth/registro') return registrarCliente(req, ctx)
  if (req.method === 'POST' && ruta === 'oauth/autorizar') return autorizar(ctx, await cuerpo(req))
  if (req.method === 'POST' && ruta === 'oauth/token') return token(req, ctx)
  if (req.method === 'POST' && ruta === 'oauth/revocar') return revocar(req)

  if (req.method === 'GET' && slug[0] === 'ficheros' && slug.length === 3) {
    const coleccion = slug[1]
    const nombre = path.basename(decodeURIComponent(slug[2]))
    if (!PUBLICOS.has(coleccion) && !PRIVADOS.has(coleccion)) throw new AppError('No encontrado.', 404)
    // Logotipos e imágenes de la web son públicos; los documentos de las empresas solo los ve quien tiene acceso a su empresa.
    if (PRIVADOS.has(coleccion)) {
      const user = exigir(ctx)
      const reg = await uno(`SELECT id FROM ${coleccion} WHERE filename = $1 AND ${visible(user, 'empresa_id')} LIMIT 1`, [nombre])
      if (!reg) throw new AppError('No tiene acceso a este archivo.', 403)
    }
    const data = await leerFichero(coleccion, { filename: nombre })
    const headers: Record<string, string> = {
      'Content-Type': tipoPorNombre(nombre),
      'Cache-Control': 'private, max-age=60',
    }
    if (new URL(req.url).searchParams.get('descarga') === '1') {
      const seguro = nombre.replace(/[\r\n"]/g, '')
      headers['Content-Disposition'] = `attachment; filename="${seguro}"`
    }
    return new Response(new Uint8Array(data), { headers })
  }

  if (req.method === 'GET' && ruta.startsWith('correos/') && ruta.endsWith('/abierto')) {
    const id = slug[1]
    const f = new URL(req.url).searchParams.get('f') ?? ''
    if (igualSeguro(f, firmar(id, 'pixel'))) await ejecutar(`UPDATE correos SET estado = 'abierto', updated_at = $2 WHERE id = $1 AND estado = 'enviado'`, [Number(id), ahora()]).catch(() => null)
    const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
    return new Response(new Uint8Array(gif), { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } })
  }

  if (req.method === 'GET' && ruta === 'catalogo/sugerencias') {
    exigir(ctx)
    const u = new URL(req.url).searchParams
    const tipo = u.get('tipo')
    if (tipo !== 'categoria' && tipo !== 'documento' && tipo !== 'relacion') throw new AppError('Tipo no válido.', 400)
    return json(await sugerir(ctx, tipo, u.get('q') ?? '', u.get('categoria')))
  }

  if (req.method === 'GET' && ruta.startsWith('descarga')) {
    const t = new URL(req.url).searchParams.get('t') ?? ''
    return descargable(await resolverEnlace(ctx, t, exportarHistorial))
  }

  if (req.method === 'POST' && ruta === 'zip') {
    exigir(ctx)
    const b = (await req.json()) as { ids?: (string | number)[]; historico?: boolean }
    return archivo(await zipDocumentos(ctx, b.ids ?? [], Boolean(b.historico)), `Documentos.zip`, 'application/zip')
  }

  if (req.method === 'GET' && slug[0] === 'inventario' && slug[1]) {
    exigir(ctx)
    const formato = new URL(req.url).searchParams.get('formato') === 'pdf' ? 'pdf' : 'xlsx'
    return descargable(await inventario(ctx, slug[1], formato))
  }

  if (req.method === 'GET' && slug[0] === 'comunicaciones' && slug[1]) {
    exigir(ctx)
    const documento = new URL(req.url).searchParams.get('documento')
    return descargable(await exportarHistorial(ctx, { empresa: slug[1], documento }))
  }

  if (req.method === 'GET' && ruta === 'almacenamiento') {
    if (!esSuperAdmin(exigir(ctx))) throw new AppError('Solo CMC.', 403)
    const { almacenamiento } = await import('@/lib/estadisticas')
    return json(await almacenamiento())
  }

  if (req.method === 'POST' && ruta === 'envios') {
    exigir(ctx)
    const f = await formulario(req)
    const meta = JSON.parse(String(f.get('_payload') ?? '{}')) as Record<string, unknown>
    const file = await ficheroDe(f.get('file'))
    const doc = await crearEnvio(ctx, {
      titulo: String(meta.titulo ?? file.name),
      empresa: Number(meta.empresa),
      documentoRelacionado: meta.documentoRelacionado ? Number(meta.documentoRelacionado) : null,
      relacion: meta.relacion ? String(meta.relacion) : null,
      nuevaCaducidad: meta.nuevaCaducidad ? String(meta.nuevaCaducidad) : null,
      comentario: meta.comentario ? String(meta.comentario) : null,
    }, file)
    if (!doc) throw new AppError('No se ha podido registrar el envío.', 500)
    return json({ doc: { id: doc.id, filesize: doc.filesize, tamanoOriginal: doc.tamanoOriginal } })
  }

  if (req.method === 'POST' && ruta === 'adjuntos') {
    exigir(ctx)
    const f = await formulario(req)
    const meta = JSON.parse(String(f.get('_payload') ?? '{}')) as { empresa?: string | number }
    const empresa = String(f.get('empresa') ?? meta.empresa ?? '')
    const a = await subirAdjunto(ctx, empresa, await ficheroDe(f.get('file')))
    return json({ doc: a })
  }

  if (req.method === 'POST' && slug[0] === 'adjuntos' && slug[2] === 'enviar-a-revision') {
    exigir(ctx)
    const b = (await req.json().catch(() => ({}))) as { documento?: string }
    const e = await adjuntoAEnvio(ctx, { adjunto: slug[1], documentoRelacionado: b.documento })
    return json({ doc: e })
  }

  if (req.method === 'POST' && ruta === 'hilos') {
    exigir(ctx)
    const b = (await req.json()) as { empresa: string; asunto: string; texto: string; documento?: string; categoria?: string; adjuntos?: number[] }
    return json({ doc: await crearHilo(ctx, b) })
  }

  if (req.method === 'POST' && ruta === 'mensajes') {
    exigir(ctx)
    const b = (await req.json()) as { hilo: number; texto: string; adjuntos?: number[] }
    return json({ doc: await escribirMensaje(ctx, b) })
  }

  if (req.method === 'POST' && ruta === 'mcp-claves') {
    const { crearClave } = await import('@/mcp/claves')
    const yo = exigir(ctx)
    const b = (await req.json()) as { label?: string; dias?: number }
    const r = await crearClave(ctx, { usuario: yo.id, label: b.label || 'Asistente de IA', origen: 'manual', dias: b.dias })
    return json(r)
  }

  return json({ errors: [{ message: 'No encontrado' }] }, 404)
}

async function responder(req: Request, slug: string[]) {
  try {
    return await atender(req, slug)
  } catch (e) {
    return errorJson(e)
  }
}

export const GET = (req: Request, ctx: { params: Promise<{ slug: string[] }> }) => ctx.params.then((p) => responder(req, p.slug))
export const POST = GET
export const PATCH = GET
export const DELETE = GET
