import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { mcpPlugin } from '@payloadcms/plugin-mcp'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { es } from '@payloadcms/translations/languages/es'
import { s3Storage } from '@payloadcms/storage-s3'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { Actividad } from './collections/Actividad'
import { Archivos } from './collections/Archivos'
import { Catalogo } from './collections/Catalogo'
import { Categorias } from './collections/Categorias'
import { Adjuntos, Hilos, Mensajes, Originales } from './collections/Comunicacion'
import { Correos } from './collections/Correos'
import { Documentos } from './collections/Documentos'
import { Empresas } from './collections/Empresas'
import { Envios } from './collections/Envios'
import { Media } from './collections/Media'
import { OAuthClientes, OAuthCodigos } from './collections/OAuth'
import { Users } from './collections/Users'
import { Videos } from './collections/Videos'
import { Consultas, Servicios, Trabajos } from './collections/Web'
import { endpoints } from './endpoints'
import { Configuracion } from './globals/Configuracion'
import { Web } from './globals/Web'
import { enviarCorreo } from './jobs/enviarCorreo'
import { recalcularEstados, resumenSemanal } from './jobs/recalcularEstados'
import { urlPostgres } from './lib/baseDatos'
import { MAX_BYTES, configS3 } from './lib/ficheros'
import { ajustarColeccionClaves, comprobarAcceso } from './mcp/claves'
import { herramientas } from './mcp/herramientas'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const serverURL = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

// Payload ignora la cookie de sesión en peticiones POST cuyo origen no esté en esta lista (aparece «No autenticado»).
// En Vercel se añaden sus direcciones (producción, rama y despliegue) y las de CMC_ORIGENES, separadas por comas.
const origenes = [
  serverURL,
  ...[process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL].filter(Boolean).map((h) => `https://${h}`),
  ...(process.env.CMC_ORIGENES || '').split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean),
].filter((o, i, todos) => todos.indexOf(o) === i)
const databaseURL = urlPostgres(process.env.DATABASE_URL || 'file:./cmc.db')

// Producción: Postgres en un servidor de la UE (DATABASE_URL=postgres://…). Local: SQLite en un fichero.
const db = /^postgres(ql)?:\/\//.test(databaseURL)
  ? postgresAdapter({
      pool: {
        connectionString: databaseURL,
        // Payload reserva una conexión para siempre al arrancar. Con una sola, el resto de consultas esperan hasta el timeout.
        max: 3,
        idleTimeoutMillis: 5000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
        ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      },
      migrationDir: path.resolve(dirname, 'migrations'),
      // En producción el esquema se crea y actualiza con las migraciones al arrancar.
      prodMigrations: migrations,
    })
  : sqliteAdapter({
      client: { url: databaseURL },
      // El esquema local ya existe. Volver a empujarlo intenta crear índices que ya están y la página se queda en Rendering.
      push: false,
    })

// Correo transaccional con remitente del dominio de CMC. Sin SMTP_HOST, los correos se muestran en consola.
const email = process.env.SMTP_HOST
  ? nodemailerAdapter({
      defaultFromAddress: process.env.EMAIL_FROM || 'avisos@localhost',
      defaultFromName: process.env.EMAIL_FROM_NAME || 'CMC · Portal documental',
      transportOptions: {
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      },
    })
  : undefined

const PROTEGIDAS = ['archivos', 'envios', 'adjuntos', 'originales'] as const

export default buildConfig({
  serverURL,
  admin: {
    user: Users.slug,
    meta: { titleSuffix: ' · CMC' },
    importMap: { baseDir: path.resolve(dirname) },
    dateFormat: 'dd/MM/yyyy',
  },
  i18n: { supportedLanguages: { es }, fallbackLanguage: 'es' },
  collections: [Empresas, Categorias, Documentos, Archivos, Envios, Hilos, Mensajes, Adjuntos, Users, Catalogo, Correos, Actividad, Media, Videos, Originales, OAuthClientes, OAuthCodigos, Servicios, Trabajos, Consultas],
  globals: [Configuracion, Web],
  endpoints,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  graphQL: { disable: true },
  cors: origenes,
  csrf: origenes,
  upload: { limits: { fileSize: MAX_BYTES } },
  db,
  email,
  sharp,
  jobs: {
    tasks: [recalcularEstados, resumenSemanal, enviarCorreo],
    autoRun: [
      { cron: '* * * * *', queue: 'correo' },
      { cron: '*/5 * * * *', queue: 'nocturna' },
    ],
    deleteJobOnComplete: false,
  },
  plugins: [
    // Archivos cifrados en reposo en un almacenamiento S3 de la UE, con enlaces de descarga temporales.
    s3Storage({
      enabled: Boolean(process.env.S3_BUCKET),
      bucket: process.env.S3_BUCKET || '',
      config: configS3(),
      acl: 'private',
      collections: {
        ...Object.fromEntries(PROTEGIDAS.map((slug) => [slug, { prefix: slug, signedDownloads: { shouldUseSignedURL: () => true, expiresIn: 300 } }])),
        media: { prefix: 'media' },
        videos: { prefix: 'portada' },
      },
    }),
    mcpPlugin({
      userCollection: 'users',
      overrideApiKeyCollection: ajustarColeccionClaves,
      overrideAuth: async (req, porDefecto) => comprobarAcceso(req, (await porDefecto()) as Record<string, any>, herramientas.map((t) => t.name)) as never,
      mcp: {
        // El SDK de MCP admite esquemas de zod 4; los tipos del plugin aún declaran zod 3.
        tools: herramientas as never,
        serverOptions: { serverInfo: { name: 'Portal documental CMC', version: '1.0.0' } },
      },
    }),
  ],
})
