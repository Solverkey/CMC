import type { CollectionConfig } from 'payload'
import { soloSuperAdmin } from '../access'
import { dirSubidas } from '../lib/ficheros'

/** Clips de la portada. La lectura es pública porque se reproducen sin sesión. */
export const Videos: CollectionConfig = {
  slug: 'videos',
  labels: { singular: 'Vídeo de portada', plural: 'Vídeos de portada' },
  admin: { group: 'Web', description: 'Mp4 o WebM. En la portada se turnan de 5 en 5 segundos.' },
  access: { read: () => true, create: soloSuperAdmin, update: soloSuperAdmin, delete: soloSuperAdmin },
  fields: [{ name: 'alt', label: 'Descripción', type: 'text' }],
  upload: { staticDir: dirSubidas('videos'), mimeTypes: ['video/mp4', 'video/webm'] },
}
