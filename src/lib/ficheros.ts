import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const urlServidor = () => (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const RAIZ_SUBIDAS = process.env.UPLOADS_DIR || path.resolve(dirname, '../../uploads')
export const dirSubidas = (coleccion: string) => path.join(RAIZ_SUBIDAS, coleccion)

export const s3Activo = () => Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)

export const MAX_BYTES = 50 * 1024 * 1024

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  txt: 'text/plain; charset=utf-8',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

export const tipoPorNombre = (nombre: string) => MIME[nombre.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'

export const configS3 = () => ({
  region: process.env.S3_REGION || 'eu-west-1',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  requestChecksumCalculation: 'WHEN_REQUIRED' as const,
  responseChecksumValidation: 'WHEN_REQUIRED' as const,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' },
})

const cliente = () => new S3Client(configS3())

let cuboListo = false
async function asegurarCubo() {
  if (cuboListo) return
  const Bucket = process.env.S3_BUCKET!
  const s3 = cliente()
  try {
    await s3.send(new HeadBucketCommand({ Bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket }))
  }
  cuboListo = true
}

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
    await asegurarCubo()
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

/** URL del portal. El fichero se lee en el servidor, esté en disco o en el cubo. */
export async function urlDe(coleccion: string, filename: string) {
  return `${urlServidor()}/api/ficheros/${coleccion}/${encodeURIComponent(filename)}`
}

export const urlPublica = (coleccion: string, filename: string) => urlDe(coleccion, filename)

export async function leerDeDiscoOBucket(coleccion: string, filename: string) {
  return leerFichero(coleccion, { filename })
}
