import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Empresas } from './collections/Empresas'
import { Categorias } from './collections/Categorias'
import { Documentos } from './collections/Documentos'
import { Archivos } from './collections/Archivos'
import { Envios } from './collections/Envios'
import { recalcularEstados } from './jobs/recalcularEstados'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' · CMC' },
    importMap: { baseDir: path.resolve(dirname) },
    dateFormat: 'dd/MM/yyyy',
  },
  collections: [Empresas, Categorias, Documentos, Archivos, Envios, Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  // Desarrollo: SQLite. Producción: cambiar a @payloadcms/db-postgres (servidor en la UE).
  db: sqliteAdapter({ client: { url: process.env.DATABASE_URL || '' } }),
  sharp,
  jobs: {
    tasks: [recalcularEstados],
    autoRun: [{ cron: '*/5 * * * *', queue: 'nocturna' }],
  },
  plugins: [],
})
