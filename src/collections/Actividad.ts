import type { CollectionConfig } from 'payload'
import { nadie, porEmpresa } from '../access'
import { ACCIONES } from '../lib/actividad'

/**
 * Registro de actividad (RF-20). Inalterable: nadie puede editarlo ni borrarlo, tampoco CMC.
 * Se conserva sin purga automática (mínimo exigido: 2 años).
 */
export const Actividad: CollectionConfig = {
  slug: 'actividad',
  labels: { singular: 'Registro de actividad', plural: 'Registro de actividad' },
  admin: { useAsTitle: 'descripcion', defaultColumns: ['createdAt', 'accion', 'descripcion', 'email', 'origen'], group: 'Plataforma', listSearchableFields: ['descripcion', 'email'] },
  defaultSort: '-createdAt',
  // CMC: todo. Administrador de empresa: lo de sus empresas. Usuario de empresa: nada.
  access: { read: porEmpresa('empresa', true), create: nadie, update: nadie, delete: nadie },
  fields: [
    { name: 'accion', type: 'select', required: true, index: true, options: [...ACCIONES] },
    { name: 'descripcion', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'usuario', type: 'relationship', relationTo: 'users', index: true },
        { name: 'email', type: 'text', admin: { description: 'Copia del email en el momento del evento.' } },
        { name: 'empresa', type: 'relationship', relationTo: 'empresas', index: true },
      ],
    },
    {
      type: 'row',
      fields: [
        {
          name: 'origen',
          type: 'select',
          index: true,
          options: [
            { label: 'Portal / administración', value: 'web' },
            { label: 'Asistente de IA (MCP)', value: 'mcp' },
            { label: 'Sistema (tareas programadas)', value: 'sistema' },
          ],
        },
        { name: 'coleccion', type: 'text' },
        { name: 'registroId', type: 'text', index: true },
      ],
    },
    { type: 'row', fields: [{ name: 'ip', type: 'text' }, { name: 'userAgent', type: 'text' }] },
    { name: 'datos', type: 'json' },
  ],
}
