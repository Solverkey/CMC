import type { CollectionConfig, SelectField, Where } from 'payload'
import { APIError } from 'payload'
import { empresasDe, isSuperAdmin, nadie, soloSuperAdmin } from '../access'
import { cambios, registrar } from '../lib/actividad'
import { leerConfiguracion } from '../lib/configuracion'
import { invitarUsuario } from '../servicios/usuarios'

export const gestionField: SelectField = {
  name: 'gestion',
  label: 'Modalidad de gestión',
  type: 'select',
  options: [
    { label: 'Gestionado por CMC', value: 'gestionado' },
    { label: 'No gestionado', value: 'no_gestionado' },
  ],
  admin: { description: 'Sin indicar hereda del nivel superior (Empresa → Categoría → Documento). Sin ningún nivel: No gestionado.' },
  access: { update: ({ req }) => isSuperAdmin(req), create: ({ req }) => isSuperAdmin(req) },
}

export const Empresas: CollectionConfig = {
  slug: 'empresas',
  labels: { singular: 'Empresa', plural: 'Empresas' },
  admin: { useAsTitle: 'razonSocial', defaultColumns: ['razonSocial', 'cif', 'gestion', 'activa'], group: 'Clientes', listSearchableFields: ['razonSocial', 'cif'] },
  access: {
    read: ({ req }): Where | boolean => {
      if (!req.user) return false
      if (isSuperAdmin(req)) return true
      const ids = empresasDe(req.user)
      return ids.length ? { and: [{ id: { in: ids } }, { activa: { equals: true } }] } : false
    },
    create: soloSuperAdmin,
    update: soloSuperAdmin,
    delete: nadie, // baja lógica: se desactiva, nunca se borra
  },
  hooks: {
    beforeValidate: [
      ({ data, operation, req }) => {
        if (operation === 'create' && !req.context?.sinAdminInicial && !data?.adminEmail) throw new APIError('Indique el email del administrador de la empresa.', 400, null, true)
        if (data?.cif) data.cif = String(data.cif).trim().toUpperCase()
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req, data }) => {
        if (operation === 'create') {
          await registrar(req, { accion: 'alta', descripcion: `Alta de la empresa «${doc.razonSocial}»`, empresa: doc.id, coleccion: 'empresas', registroId: doc.id })
          if (data.aplicarPlantilla !== false) {
            const cfg = await leerConfiguracion(req.payload, req)
            let orden = 0
            for (const c of cfg.plantillaCategorias) {
              await req.payload.create({ collection: 'categorias', data: { nombre: c.nombre, empresa: doc.id, antelacionMeses: c.antelacionMeses ?? undefined, gestion: (c.gestion as 'gestionado') ?? undefined, descripcion: c.descripcion ?? undefined, orden: orden++ }, overrideAccess: true, req })
            }
          }
          if (data.adminEmail) await invitarUsuario(req, { email: data.adminEmail, nombre: data.adminNombre, empresa: doc.id, rol: 'admin' })
          return doc
        }
        if (previousDoc && previousDoc.activa !== doc.activa) {
          await registrar(req, { accion: doc.activa ? 'alta' : 'baja', descripcion: `${doc.activa ? 'Reactivación' : 'Baja lógica'} de la empresa «${doc.razonSocial}»`, empresa: doc.id, coleccion: 'empresas', registroId: doc.id })
        }
        const diff = cambios(previousDoc, doc)
        delete diff.activa
        if (Object.keys(diff).length) await registrar(req, { accion: 'edicion', descripcion: `Edición de la empresa «${doc.razonSocial}»`, empresa: doc.id, coleccion: 'empresas', registroId: doc.id, datos: { cambios: diff } })
        return doc
      },
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        { name: 'razonSocial', label: 'Razón social', type: 'text', required: true },
        { name: 'cif', label: 'CIF', type: 'text', required: true, unique: true },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'direccion', label: 'Dirección', type: 'text' },
        { name: 'sector', type: 'text' },
      ],
    },
    { name: 'logo', label: 'Logotipo', type: 'upload', relationTo: 'media' },
    { name: 'contacto', label: 'Contacto principal', type: 'text' },
    {
      name: 'emailsAviso',
      label: 'Emails de aviso',
      type: 'array',
      admin: { description: 'Reciben los avisos de caducidad de esta empresa, además de sus administradores.' },
      fields: [{ name: 'email', type: 'email', required: true }],
    },
    gestionField,
    {
      name: 'antelacionMeses',
      label: 'Antelación de aviso (meses)',
      type: 'number',
      min: 0,
      admin: { description: 'Estándar de este cliente. Vacío = el de la plataforma. Una categoría o un documento pueden cambiarlo.' },
    },
    { name: 'tecnico', label: 'Técnico de CMC responsable', type: 'relationship', relationTo: 'users', filterOptions: { rol: { equals: 'superadmin' } } },
    { name: 'activa', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar', description: 'Baja lógica: bloquea los accesos y conserva el histórico. Se puede reactivar.' } },
    {
      type: 'collapsible',
      label: 'Administrador de la empresa',
      admin: { condition: (_, __, { operation }) => operation === 'create', description: 'CMC crea el administrador al dar de alta la empresa. Recibirá una invitación por correo.' },
      fields: [
        {
          type: 'row',
          fields: [
            { name: 'adminEmail', label: 'Email del administrador', type: 'email', virtual: true },
            { name: 'adminNombre', label: 'Nombre del administrador', type: 'text', virtual: true },
          ],
        },
        { name: 'aplicarPlantilla', label: 'Crear las categorías estándar de CMC', type: 'checkbox', defaultValue: true, virtual: true },
      ],
    },
  ],
}

