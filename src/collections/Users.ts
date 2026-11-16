import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { empresasDe, isSuperAdmin } from '../access'

const gestionaUsuarios = (req: PayloadRequest) =>
  isSuperAdmin(req) || empresasDe(req.user, true).length > 0

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Usuario', plural: 'Usuarios' },
  admin: { useAsTitle: 'email', defaultColumns: ['nombre', 'email', 'rol'], group: 'Accesos' },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,
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
    create: ({ req }) => Boolean(req.user) && gestionaUsuarios(req),
    update: ({ req }) => {
      if (!req.user) return false
      if (isSuperAdmin(req)) return true
      const ids = empresasDe(req.user, true)
      return { or: [{ id: { equals: req.user.id } }, ...(ids.length ? [{ 'empresas.empresa': { in: ids } }] : [])] } as Where
    },
    delete: ({ req }) => isSuperAdmin(req),
    admin: ({ req }) => isSuperAdmin(req),
  },
  hooks: {
    beforeChange: [
      ({ req, data, originalDoc }) => {
        if (!req.user || isSuperAdmin(req)) return data
        // Un admin de empresa no puede crear super admins ni dar acceso a empresas que no administra.
        if (data.rol === 'superadmin') throw new APIError('No puede asignar el rol de super administrador.', 403)
        const propias = empresasDe(req.user, true).map(String)
        const antes = new Set(empresasDe(originalDoc).map(String))
        for (const m of data.empresas ?? []) {
          const id = String(typeof m.empresa === 'object' ? m.empresa?.id : m.empresa)
          if (!antes.has(id) && !propias.includes(id)) throw new APIError('Solo puede dar acceso a las empresas que administra.', 403)
        }
        return data
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
      access: { update: ({ req }) => isSuperAdmin(req) },
    },
    {
      name: 'empresas',
      label: 'Acceso a empresas',
      type: 'array',
      admin: { description: 'Un mismo usuario puede tener acceso a varias empresas, con un rol en cada una.' },
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
      access: { update: ({ req }) => isSuperAdmin(req) },
    },
  ],
}
