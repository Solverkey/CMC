import type { CollectionConfig } from 'payload'
import { porEmpresa, soloSuperAdmin } from '../access'
import { gestionField } from './Empresas'

export const Categorias: CollectionConfig = {
  slug: 'categorias',
  labels: { singular: 'Categoría', plural: 'Categorías' },
  admin: { useAsTitle: 'nombre', defaultColumns: ['nombre', 'empresa', 'antelacionMeses'], group: 'Documentación' },
  access: { read: porEmpresa(), create: soloSuperAdmin, update: soloSuperAdmin, delete: soloSuperAdmin },
  fields: [
    { name: 'nombre', type: 'text', required: true, admin: { description: 'ISO, OCA, Licencias, Proyectos…' } },
    { name: 'empresa', type: 'relationship', relationTo: 'empresas', required: true, index: true },
    { name: 'descripcion', label: 'Descripción', type: 'textarea' },
    {
      name: 'antelacionMeses',
      label: 'Antelación de aviso (meses)',
      type: 'number',
      min: 0,
      admin: { description: 'Vacío = valor de la plataforma (2 meses).' },
    },
    gestionField,
    { name: 'responsable', type: 'relationship', relationTo: 'users' },
    { name: 'orden', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
    { name: 'archivada', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}
