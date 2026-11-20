import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const urlServidor = () => (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const RAIZ_SUBIDAS = process.env.UPLOADS_DIR || path.resolve(dirname, '../../uploads')
export const dirSubidas = (coleccion: string) => path.join(RAIZ_SUBIDAS, coleccion)

export const s3Activo = () => Boolean(process.env.S3_BUCKET)

export const MAX_BYTES = 50 * 1024 * 1024

const PROTEGIDAS = new Set(['archivos', 'envios', 'adjuntos', 'originales'])

export const configS3 = () => ({
  region: process.env.S3_REGION || 'eu-south-2',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' },
})

const cliente = () => new S3Client(configS3())

const clave = (coleccion: string, filename: string) => path.posix.join(coleccion, filename)

const nombreSeguro = (name: string) => {
  const base = path.basename(name).replace(/[^\w.\-]+/g, '_').slice(-80) || 'archivo'
  const extra = Math.random().toString(36).slice(2, 8)
  const punto = base.lastIndexOf('.')
  if (punto <= 0) return `${base}-${extra}`
  return `${base.slice(0, punto)}-${extra}${base.slice(punto)}`
}

export type FicheroGuardado = { filename: string; mimeType: string; filesize: number; url: string; width?: number | null; height?: number | null }

/** Guarda un fichero en S3 (si hay cubo) o en disco, y devuelve el nombre con el que se sirve. */
export async function guardarFichero(coleccion: string, file: { data: Buffer; name: string; mimetype: string }): Promise<FicheroGuardado> {
  const filename = nombreSeguro(file.name)
  if (s3Activo()) {
    await cliente().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: clave(coleccion, filename), Body: file.data, ContentType: file.mimetype }))
  } else {
    const dir = dirSubidas(coleccion)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, filename), file.data)
  }
  return { filename, mimeType: file.mimetype, filesize: file.data.length, url: await urlDe(coleccion, filename) }
}

/** Contenido de un fichero subido, esté en disco o en el almacenamiento S3 de la UE. */
export async function leerFichero(_coleccionOPayload: unknown, coleccionODoc?: string | { filename?: string | null }, doc?: { filename?: string | null }): Promise<Buffer> {
  const coleccion = typeof coleccionODoc === 'string' ? coleccionODoc : typeof _coleccionOPayload === 'string' ? _coleccionOPayload : ''
  const registro = doc ?? (typeof coleccionODoc === 'object' ? coleccionODoc : undefined)
  if (!registro?.filename || !coleccion) throw new Error('El registro no tiene fichero')
  if (s3Activo()) {
    const res = await cliente().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: clave(coleccion, registro.filename) }))
    return Buffer.from(await res.Body!.transformToByteArray())
  }
  return fs.readFile(path.join(dirSubidas(coleccion), path.basename(registro.filename)))
}

/** URL para abrir el fichero. Las colecciones privadas salen firmadas 5 minutos; el resto, por la ruta del portal. */
export async function urlDe(coleccion: string, filename: string) {
  if (s3Activo() && PROTEGIDAS.has(coleccion)) {
    return getSignedUrl(cliente(), new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key: clave(coleccion, filename) }), { expiresIn: 300 })
  }
  return `${urlServidor()}/api/ficheros/${coleccion}/${encodeURIComponent(filename)}`
}

export const urlPublica = (coleccion: string, filename: string) => urlDe(coleccion, filename)

export async function leerDeDiscoOBucket(coleccion: string, filename: string) {
  return leerFichero(coleccion, { filename })
}
