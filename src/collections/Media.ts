import type { CollectionConfig } from 'payload'
import { soloSuperAdmin } from '../access'
import { dirSubidas } from '../lib/ficheros'
import { comprimirImagenes } from '../lib/subidas'

/** Imágenes públicas: logotipos de las empresas y de CMC (portal y correos) e imágenes de la web. */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Imagen', plural: 'Imágenes y logotipos' },
  admin: { group: 'Plataforma' },
  // Lectura pública: la web y los correos las muestran fuera de la sesión.
  access: { read: () => true, create: soloSuperAdmin, update: soloSuperAdmin, delete: soloSuperAdmin },
  hooks: { beforeOperation: [comprimirImagenes] },
  fields: [{ name: 'alt', label: 'Texto alternativo', type: 'text', required: true }],
  upload: { staticDir: dirSubidas('media'), mimeTypes: ['image/*'] },
}

