import type { CollectionConfig } from 'payload'
import { nadie, porEmpresa, soloSuperAdmin } from '../access'
import { auditar } from '../lib/actividad'
import { usarNombre } from '../lib/catalogo'
import { gestionField } from './Empresas'

export const campoCatalogo = (tipo: 'categoria' | 'documento' | 'relacion') => ({
  Field: { path: '/components/admin/CampoCatalogo#CampoCatalogo', clientProps: { tipo } },
})

export const Categorias: CollectionConfig = {
  slug: 'categorias',
  labels: { singular: 'Categoría', plural: 'Categorías' },
  admin: { useAsTitle: 'nombre', defaultColumns: ['nombre', 'empresa', 'antelacionMeses', 'gestion', 'archivada'], group: 'Documentación' },
  defaultSort: 'orden',
  // Se archivan, no se borran: sus documentos y su histórico se conservan.
  access: { read: porEmpresa(), create: soloSuperAdmin, update: soloSuperAdmin, delete: nadie },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'create' || doc.nombre !== previousDoc?.nombre) await usarNombre(req, 'categoria', doc.nombre)
        return doc
      },
      auditar('categoría', (d) => String(d.nombre)),
    ],
  },
  fields: [
    { name: 'nombre', type: 'text', required: true, admin: { description: 'ISO, OCA, Licencias, Proyectos… Escriba para buscar en el catálogo o añadir un nombre nuevo.', components: campoCatalogo('categoria') } },
    { name: 'empresa', type: 'relationship', relationTo: 'empresas', required: true, index: true },
    { name: 'descripcion', label: 'Descripción', type: 'textarea' },
    {
      name: 'antelacionMeses',
      label: 'Antelación de aviso (meses)',
      type: 'number',
      min: 0,
      admin: { description: 'Vacío = valor de la plataforma (2 meses por defecto). Aplica a los documentos nuevos de esta categoría.' },
    },
    gestionField,
    { name: 'responsable', label: 'Responsable de CMC', type: 'relationship', relationTo: 'users', filterOptions: { rol: { equals: 'superadmin' } } },
    { name: 'orden', type: 'number', defaultValue: 0, admin: { position: 'sidebar' } },
    { name: 'archivada', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar' } },
  ],
}
