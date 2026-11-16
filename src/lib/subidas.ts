import path from 'path'
import sharp from 'sharp'
import type { CollectionAfterChangeHook, CollectionBeforeOperationHook, PayloadRequest, TypeWithID } from 'payload'
import { APIError } from 'payload'
import { registrar } from './actividad'
import { leerConfiguracion } from './configuracion'
import { MAX_BYTES } from './ficheros'

export const MIME_DOCUMENTOS = [
  'application/pdf',
  'image/*',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.*',
]

type Fichero = { data: Buffer; mimetype: string; name: string; size: number }

const esHeic = (f: Fichero) => /image\/hei[cf]/.test(f.mimetype) || /\.hei[cf]$/i.test(f.name)
const esImagenComprimible = (f: Fichero) => esHeic(f) || (/^image\//.test(f.mimetype) && !/svg|gif|webp/.test(f.mimetype))

/**
 * Compresión automática de imágenes (RF-22): HEIC → visible en navegador, lado mayor y calidad según la
 * configuración, formato WebP. Los PDF y los Office no se tocan. Se guarda el tamaño original.
 */
export const comprimirImagenes: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'create' && operation !== 'update') return args
  const file = req.file as Fichero | undefined
  if (!file?.data) return args
  if (file.size > MAX_BYTES) throw new APIError('El archivo supera el límite de 50 MB.', 413)
  if (req.context?.sinComprimir || !esImagenComprimible(file)) return args

  const cfg = await leerConfiguracion(req.payload, req)
  const original = { data: file.data, mimetype: file.mimetype, name: file.name, size: file.size }
  let entrada = file.data
  if (esHeic(file)) {
    const convertir = (await import('heic-convert')).default
    entrada = Buffer.from(await convertir({ buffer: file.data, format: 'JPEG', quality: 0.95 }))
  }
  const salida = await sharp(entrada)
    .rotate()
    .resize({ width: cfg.ladoMaximo, height: cfg.ladoMaximo, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: cfg.calidad })
    .toBuffer()

  const base = path.parse(file.name).name
  req.file = { ...file, data: salida, mimetype: 'image/webp', name: `${base}.webp`, size: salida.length } as typeof req.file
  args.data = { ...(args.data ?? {}), tamanoOriginal: original.size } as unknown as typeof args.data
  if (cfg.conservarOriginal) req.context.imagenOriginal = original
  return args
}

/** Si la configuración lo pide, la imagen original queda guardada aparte (solo visible para CMC). */
export const guardarOriginal: CollectionAfterChangeHook = async ({ doc, req, collection, operation }) => {
  const original = req.context.imagenOriginal as Fichero | undefined
  if (!original || operation !== 'create') return doc
  delete req.context.imagenOriginal
  await req.payload.create({
    collection: 'originales',
    overrideAccess: true,
    req,
    context: { sinComprimir: true },
    data: { coleccion: collection.slug, registroId: String(doc.id), empresa: typeof doc.empresa === 'object' ? doc.empresa?.id : doc.empresa },
    file: original,
  })
  return doc
}

/** Cada acceso a un fichero queda en el registro de actividad. Devuelve vacío para que Payload sirva el fichero. */
export const registrarDescarga = async (req: PayloadRequest, { doc, params }: { doc: TypeWithID; params: { collection: string; filename: string } }) => {
  if (!req.user) return
  const d = doc as TypeWithID & { empresa?: unknown; filename?: string }
  await registrar(req, {
    accion: 'descarga',
    descripcion: `Descarga de «${d.filename ?? params.filename}»`,
    empresa: d.empresa as number,
    coleccion: params.collection,
    registroId: doc.id,
  })
}

export const tamano = (n?: number | null) => {
  if (!n) return '—'
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2).replace('.', ',')} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}
