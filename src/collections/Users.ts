import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import type { User } from '@/payload-types'
import { empresasDe, esSuperAdmin, isSuperAdmin, nadie } from '../access'
import { cambios, registrar } from '../lib/actividad'
import { leerConfiguracion, urlServidor } from '../lib/configuracion'
import { maquetar } from '../lib/correo'
import { rellenar } from '../lib/texto'
import { activar2FA, comprobarCodigoLogin, desactivar2FA, iniciar2FA } from '../servicios/seguridad'
import { aceptarInvitacion, cambiarRol, comprobarAdministradores, enviarInvitacion, invitarUsuario, quitarAcceso, usuariosDeEmpresa, validarPassword } from '../servicios/usuarios'

const idDe = (v: unknown) => String(v && typeof v === 'object' && 'id' in v ? (v as { id: unknown }).id : v)

const json = async (req: PayloadRequest) => ((await req.json?.().catch(() => ({}))) ?? {}) as Record<string, any>

const responder = async (fn: () => Promise<unknown>) => {
  try {
    return Response.json((await fn()) ?? { ok: true })
  } catch (e) {
    const err = e as APIError
    return Response.json({ errors: [{ message: err.message }] }, { status: err.status ?? 500 })
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Usuario', plural: 'Usuarios' },
  admin: { useAsTitle: 'email', defaultColumns: ['nombre', 'email', 'rol', 'activo'], group: 'Accesos' },
  // Al aparecer como autor, remitente o técnico, solo se muestran estos datos (no sus empresas ni sesiones).
  defaultPopulate: { nombre: true, email: true, rol: true },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
    tokenExpiration: 8 * 60 * 60,
    cookies: { secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' },
    forgotPassword: {
      expiration: 60 * 60 * 1000,
      generateEmailSubject: async (args) => {
        const cfg = await leerConfiguracion(args!.req!.payload, args?.req)
        return cfg.plantilla('recuperar_password').asunto
      },
      generateEmailHTML: async (args) => {
        const cfg = await leerConfiguracion(args!.req!.payload, args?.req)
        const t = cfg.plantilla('recuperar_password')
        const vars = { nombre: (args?.user as User)?.nombre }
        return maquetar(cfg, { asunto: rellenar(t.asunto, vars), cuerpo: rellenar(t.cuerpo, vars), boton: t.boton, enlace: `${urlServidor()}/portal/restablecer?token=${args?.token}` })
      },
    },
  },
  access: {
    // CMC ve a todos; el admin de empresa ve a los usuarios de sus empresas; cada uno se ve a sí mismo.
    read: ({ req }) => {
      if (!req.user) return false
      if (isSuperAdmin(req)) return true
      const ids = empresasDe(req.user, true)
      const where: Where = { or: [{ id: { equals: req.user.id } }] }
      if (ids.length) where.or!.push({ 'empresas.empresa': { in: ids } })
      return where
    },
    // Los administradores de empresa dan de alta por /api/users/invitar, que aplica sus límites.
    create: ({ req }) => isSuperAdmin(req),
    update: ({ req }) => {
      if (!req.user) return false
      if (isSuperAdmin(req)) return true
      return { id: { equals: req.user.id } }
    },
    delete: nadie,
    admin: ({ req }) => isSuperAdmin(req),
  },
  endpoints: [
    {
      path: '/invitar',
      method: 'post',
      handler: (req) => responder(async () => {
        const b = await json(req)
        const r = await invitarUsuario(req, { email: String(b.email ?? ''), nombre: b.nombre, empresa: b.empresa, rol: b.rol })
        return { id: r.usuario.id, creado: r.creado }
      }),
    },
    {
      path: '/de-empresa/:empresa',
      method: 'get',
      handler: (req) => responder(() => usuariosDeEmpresa(req, req.routeParams!.empresa as string)),
    },
    {
      path: '/:id/quitar-acceso',
      method: 'post',
      handler: (req) => responder(async () => {
        const b = await json(req)
        await quitarAcceso(req, { usuario: req.routeParams!.id as string, empresa: b.empresa })
      }),
    },
    {
      path: '/:id/rol',
      method: 'post',
      handler: (req) => responder(async () => {
        const b = await json(req)
        await cambiarRol(req, { usuario: req.routeParams!.id as string, empresa: b.empresa, rol: b.rol })
      }),
    },
    {
      path: '/:id/reenviar-invitacion',
      method: 'post',
      handler: (req) => responder(async () => {
        const u = (await req.payload.findByID({ collection: 'users', id: req.routeParams!.id as string, user: req.user, overrideAccess: false, depth: 1, req })) as User
        const compartida = (u.empresas ?? []).find((m) => esSuperAdmin(req.user) || empresasDe(req.user, true).map(String).includes(idDe(m.empresa)))
        if (!compartida) throw new APIError('No administra a este usuario.', 403, null, true)
        await enviarInvitacion(req, u, typeof compartida.empresa === 'object' ? compartida.empresa : null)
      }),
    },
    {
      path: '/aceptar-invitacion',
      method: 'post',
      handler: (req) => responder(async () => {
        const b = await json(req)
        await aceptarInvitacion(req, String(b.token ?? ''), String(b.password ?? ''))
      }),
    },
    { path: '/2fa/iniciar', method: 'post', handler: (req) => responder(() => iniciar2FA(req)) },
    { path: '/2fa/activar', method: 'post', handler: (req) => responder(async () => activar2FA(req, String((await json(req)).codigo ?? ''))) },
    { path: '/2fa/desactivar', method: 'post', handler: (req) => responder(async () => desactivar2FA(req, String((await json(req)).codigo ?? ''))) },
  ],
  hooks: {
    beforeLogin: [
      async ({ req, user }) => {
        const u = (await req.payload.findByID({ collection: 'users', id: user.id, showHiddenFields: true, overrideAccess: true, depth: 1, req })) as User & { totpSecreto?: string; totpUltimoPaso?: number }
        if (u.activo === false) throw new APIError('Su acceso está desactivado. Contacte con CMC.', 403, null, true)
        if (u.rol !== 'superadmin' && !(u.empresas ?? []).some((m) => typeof m.empresa === 'object' && m.empresa?.activa)) throw new APIError('No tiene acceso a ninguna empresa activa. Contacte con CMC.', 403, null, true)
        const paso = comprobarCodigoLogin(u, (req.data as Record<string, unknown> | undefined)?.codigo)
        if (paso) await req.payload.update({ collection: 'users', id: u.id, data: { totpUltimoPaso: paso }, overrideAccess: true, req, context: { sinAuditoria: true } })
        return user
      },
    ],
    afterLogin: [
      async ({ req, user }) => {
        await registrar(req, { accion: 'login', descripcion: `Inicio de sesión de ${user.email}`, usuario: user, coleccion: 'users', registroId: user.id })
      },
    ],
    afterLogout: [
      async ({ req }) => {
        if (req.user) await registrar(req, { accion: 'logout', descripcion: `Cierre de sesión de ${(req.user as { email?: string }).email}`, coleccion: 'users', registroId: req.user.id })
      },
    ],
    afterError: [
      async ({ req, error }) => {
        if (!req.url?.includes('/users/login')) return
        const email = String((req.data as Record<string, unknown> | undefined)?.email ?? '').slice(0, 200)
        const es2FA = Boolean(((error as APIError).data as { requiere2fa?: boolean } | null)?.requiere2fa)
        if (es2FA && !(req.data as Record<string, unknown>)?.codigo) return
        if (es2FA && email) {
          const { docs } = await req.payload.find({ collection: 'users', where: { email: { equals: email.toLowerCase() } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true })
          const u = docs[0] as (User & { loginAttempts?: number }) | undefined
          if (u) {
            const intentos = (u.loginAttempts ?? 0) + 1
            await req.payload.db.updateOne({ collection: 'users', id: u.id, data: { loginAttempts: intentos, ...(intentos >= 5 ? { lockUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString() } : {}) } })
          }
        }
        await registrar(req, { accion: 'login_fallido', descripcion: `Inicio de sesión fallido para ${email || 'email vacío'}: ${error.message}`, usuario: null, coleccion: 'users', datos: { email } }, { aislado: true })
      },
    ],
    beforeValidate: [
      ({ data }) => {
        if (data?.password) validarPassword(data.password)
        if (data?.email) data.email = String(data.email).trim().toLowerCase()
        return data
      },
    ],
    beforeChange: [
      async ({ req, data, originalDoc, operation }) => {
        if (operation !== 'update' || req.context?.sinAuditoria) return data
        const empresas = (data.empresas ?? originalDoc?.empresas ?? []).map((m: { empresa: unknown; rol: 'admin' | 'usuario' }) => ({ empresa: idDe(m.empresa), rol: m.rol }))
        const rol = data.rol ?? originalDoc?.rol
        // Un usuario de empresa que se queda sin empresas se da de baja.
        if (rol === 'cliente' && data.empresas && !empresas.length) data.activo = false
        await comprobarAdministradores(req, originalDoc as User, { empresas, activo: (data.activo ?? originalDoc?.activo) !== false })
        return data
      },
    ],
    afterChange: [
      async ({ req, doc, previousDoc, operation }) => {
        if (req.context?.sinAuditoria) return doc
        if (operation === 'create') {
          await registrar(req, { accion: 'alta', descripcion: `Alta del usuario ${doc.email}`, coleccion: 'users', registroId: doc.id })
          if (!req.context?.sinInvitacion) await enviarInvitacion(req, doc as User)
          return doc
        }
        const diff = cambios(previousDoc, doc)
        if (Object.keys(diff).length) await registrar(req, { accion: diff.empresas || diff.rol || diff.activo ? 'permisos' : 'edicion', descripcion: `Cambios en el usuario ${doc.email}`, coleccion: 'users', registroId: doc.id, datos: { cambios: diff } })
        return doc
      },
    ],
  },
  fields: [
    { name: 'nombre', type: 'text', required: true },
    {
      name: 'rol',
      type: 'select',
      defaultValue: 'cliente',
      required: true,
      options: [
        { label: 'Super administrador (CMC)', value: 'superadmin' },
        { label: 'Cliente', value: 'cliente' },
      ],
      access: { update: ({ req }) => isSuperAdmin(req), create: ({ req }) => isSuperAdmin(req) },
    },
    {
      name: 'empresas',
      label: 'Acceso a empresas',
      type: 'array',
      admin: { description: 'Un mismo usuario puede tener acceso a varias empresas, con un rol en cada una.' },
      access: { update: ({ req }) => isSuperAdmin(req), create: ({ req }) => isSuperAdmin(req) },
      fields: [
        { name: 'empresa', type: 'relationship', relationTo: 'empresas', required: true },
        {
          name: 'rol',
          type: 'select',
          required: true,
          defaultValue: 'usuario',
          options: [
            { label: 'Administrador de empresa', value: 'admin' },
            { label: 'Usuario de empresa', value: 'usuario' },
          ],
        },
      ],
    },
    {
      name: 'recibeAvisos',
      type: 'checkbox',
      defaultValue: false,
      label: 'Recibe avisos de caducidad',
      admin: { description: 'Usuarios de empresa: según configure CMC. Super administradores: avisos y resumen semanal.' },
      access: { update: ({ req }) => isSuperAdmin(req), create: ({ req }) => isSuperAdmin(req) },
    },
    {
      name: 'activo',
      type: 'checkbox',
      defaultValue: true,
      admin: { position: 'sidebar', description: 'Desactivado: no puede entrar. Nunca se borra, para conservar la trazabilidad.' },
      access: { update: ({ req }) => isSuperAdmin(req), create: ({ req }) => isSuperAdmin(req) },
    },
    { name: 'totpActivo', label: 'Doble factor activado', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', readOnly: true }, access: { update: () => false, create: () => false } },
    { name: 'totpSecreto', type: 'text', hidden: true },
    { name: 'totpPendiente', type: 'text', hidden: true },
    { name: 'totpUltimoPaso', type: 'number', hidden: true },
    { name: 'invitacionHash', type: 'text', hidden: true },
  ],
}
