import type { CollectionConfig } from 'payload'
import { soloSuperAdmin } from '../access'
import { dirSubidas } from '../lib/ficheros'
import { comprimirImagenes } from '../lib/subidas'

/** Logotipos de las empresas y de CMC (portal y correos). */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Logotipo', plural: 'Logotipos' },
  admin: { group: 'Plataforma' },
  // Lectura pública: los correos muestran el logotipo de CMC fuera de la sesión.
  access: { read: () => true, create: soloSuperAdmin, update: soloSuperAdmin, delete: soloSuperAdmin },
  hooks: { beforeOperation: [comprimirImagenes] },
  fields: [{ name: 'alt', label: 'Texto alternativo', type: 'text', required: true }],
  upload: { staticDir: dirSubidas('media'), mimeTypes: ['image/*'] },
}

