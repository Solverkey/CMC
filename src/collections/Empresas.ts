import type { CollectionConfig } from 'payload'
import { empresasDe, isSuperAdmin, soloSuperAdmin } from '../access'

export const gestionField = {
  name: 'gestion',
  label: 'Modalidad de gestión',
  type: 'select' as const,
  options: [
    { label: 'Gestionado por CMC', value: 'gestionado' },
    { label: 'No gestionado', value: 'no_gestionado' },
  ],
  admin: { description: 'Sin indicar hereda del nivel superior (Empresa → Categoría → Documento).' },
  access: { update: ({ req }: { req: any }) => isSuperAdmin(req), create: ({ req }: { req: any }) => isSuperAdmin(req) },
}

export const Empresas: CollectionConfig = {
  slug: 'empresas',
  labels: { singular: 'Empresa', plural: 'Empresas' },
  admin: { useAsTitle: 'razonSocial', defaultColumns: ['razonSocial', 'cif', 'gestion', 'activa'], group: 'Clientes' },
  access: {
    read: ({ req }) => {
      if (!req.user) return false
      if (isSuperAdmin(req)) return true
      const ids = empresasDe(req.user)
      return ids.length ? { id: { in: ids } } : false
    },
    create: soloSuperAdmin,
    update: soloSuperAdmin,
    delete: () => false, // baja lógica: se desactiva, nunca se borra
  },
  fields: [
    { name: 'razonSocial', label: 'Razón social', type: 'text', required: true },
    { name: 'cif', label: 'CIF', type: 'text', required: true, unique: true },
    { name: 'direccion', label: 'Dirección', type: 'text' },
    { name: 'sector', type: 'text' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'contacto', label: 'Contacto principal', type: 'text' },
    {
      name: 'emailsAviso',
      label: 'Emails de aviso',
      type: 'array',
      fields: [{ name: 'email', type: 'email', required: true }],
    },
    gestionField,
    { name: 'tecnico', label: 'Técnico de CMC responsable', type: 'relationship', relationTo: 'users' },
    { name: 'activa', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar' } },
  ],
}
