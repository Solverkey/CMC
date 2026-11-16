import type { CollectionConfig } from 'payload'
import { autenticado, soloSuperAdmin } from '../access'

/** Imágenes públicas de la web y logotipos de empresa. */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Imagen', plural: 'Imágenes' },
  admin: { group: 'Web' },
  access: { read: () => true, create: soloSuperAdmin, update: soloSuperAdmin, delete: soloSuperAdmin },
  fields: [{ name: 'alt', label: 'Texto alternativo', type: 'text', required: true }],
  upload: { staticDir: 'uploads/media', resizeOptions: { width: 2000, withoutEnlargement: true }, formatOptions: { format: 'webp', options: { quality: 80 } } },
}
void autenticado
