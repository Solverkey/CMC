import type { CollectionConfig } from 'payload'
import { isSuperAdmin, porEmpresa, soloSuperAdmin } from '../access'

export const EFECTOS = [
  { label: 'Sustituye al vigente', value: 'sustituye' },
  { label: 'Actualiza fechas', value: 'actualiza_fechas' },
  { label: 'Puede levantar la condición', value: 'levanta' },
  { label: 'Complementario', value: 'complementario' },
] as const

/** Efectos por defecto de los tipos de relación iniciales (informe funcional, apartado 3). */
export const EFECTOS_POR_TIPO: Record<string, string[]> = {
  Renovación: ['sustituye', 'actualiza_fechas'],
  Actualización: ['sustituye'],
  Subsanación: ['levanta'],
  Anexo: ['complementario'],
  Original: ['sustituye'],
}

export const Archivos: CollectionConfig = {
  slug: 'archivos',
  labels: { singular: 'Archivo asociado', plural: 'Archivos asociados' },
  admin: { useAsTitle: 'filename', defaultColumns: ['filename', 'documento', 'relacion', 'createdAt'], group: 'Documentación' },
  access: { read: porEmpresa(), create: soloSuperAdmin, update: soloSuperAdmin, delete: () => false },
  upload: {
    staticDir: 'uploads/archivos',
    mimeTypes: [
      'application/pdf',
      'image/*',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.*',
      'application/vnd.ms-excel',
    ],
    // Compresión automática de imágenes (RF-22): lado mayor 2.500 px y WebP calidad 82. PDF y Office no se tocan.
    resizeOptions: { width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 82 } },
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation === 'create' && req.user) data.subidoPor = req.user.id
        if (operation === 'create' && !data.efectos?.length && data.relacion) data.efectos = EFECTOS_POR_TIPO[data.relacion] ?? ['complementario']
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation !== 'create') return doc
        const docId = typeof doc.documento === 'object' ? doc.documento.id : doc.documento
        const efectos: string[] = doc.efectos ?? []
        const update: Record<string, unknown> = {}
        if (efectos.includes('sustituye')) {
          update.archivoVigente = doc.id
          // El anterior queda en el histórico como «No aplica».
          await req.payload.update({
            collection: 'archivos',
            where: { and: [{ documento: { equals: docId } }, { id: { not_equals: doc.id } }] },
            data: { historico: true },
            req,
          })
        }
        if (efectos.includes('actualiza_fechas') && doc.nuevaCaducidad) {
          update.fechaCaducidad = doc.nuevaCaducidad
          if (doc.nuevoAviso) {
            update.fechaAviso = doc.nuevoAviso
            update.avisoManual = true
          } else update.avisoManual = false
          update.estadoManual = null
        }
        if (efectos.includes('levanta')) update.estadoManual = null
        if (Object.keys(update).length) await req.payload.update({ collection: 'documentos', id: docId, data: update, req })
        return doc
      },
    ],
  },
  fields: [
    { name: 'documento', type: 'relationship', relationTo: 'documentos', required: true, index: true },
    { name: 'empresa', type: 'relationship', relationTo: 'empresas', required: true, index: true, admin: { description: 'Se usa para el control de acceso.' } },
    {
      name: 'relacion',
      label: 'Tipo de relación',
      type: 'text',
      required: true,
      defaultValue: 'Original',
      admin: { description: 'Campo abierto: Renovación, Actualización, Subsanación, Anexo… o uno nuevo.' },
    },
    { name: 'efectos', type: 'select', hasMany: true, options: [...EFECTOS] },
    {
      type: 'row',
      fields: [
        { name: 'nuevaCaducidad', label: 'Nueva caducidad', type: 'date' },
        { name: 'nuevoAviso', label: 'Nuevo aviso', type: 'date' },
      ],
    },
    { name: 'comentario', type: 'textarea' },
    { name: 'historico', type: 'checkbox', defaultValue: false, admin: { readOnly: true, description: 'Sustituido: estado Negro (No aplica).' } },
    { name: 'subidoPor', type: 'relationship', relationTo: 'users', admin: { readOnly: true }, access: { update: ({ req }) => isSuperAdmin(req) } },
  ],
}
