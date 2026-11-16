import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import type { Payload } from 'payload'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const RAIZ_SUBIDAS = process.env.UPLOADS_DIR || path.resolve(dirname, '../../uploads')
export const dirSubidas = (coleccion: string) => path.join(RAIZ_SUBIDAS, coleccion)

export const s3Activo = () => Boolean(process.env.S3_BUCKET)

export const MAX_BYTES = 50 * 1024 * 1024

/** Contenido de un fichero subido, esté en disco o en el almacenamiento S3 de la UE. */
export async function leerFichero(payload: Payload, coleccion: string, doc: { filename?: string | null; prefix?: string | null }): Promise<Buffer> {
  if (!doc.filename) throw new Error('El registro no tiene fichero')
  if (s3Activo()) {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
    const client = new S3Client(configS3())
    const Key = path.posix.join(doc.prefix || coleccion, doc.filename)
    const res = await client.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET!, Key }))
    return Buffer.from(await res.Body!.transformToByteArray())
  }
  const ruta = path.join(dirSubidas(coleccion), path.basename(doc.filename))
  void payload
  return fs.readFile(ruta)
}

export const configS3 = () => ({
  region: process.env.S3_REGION || 'eu-south-2',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID || '', secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '' },
})
