import path from 'path'
import sharp from 'sharp'
import { AppError } from './appError'
import { leerConfiguracion } from './configuracion'

export const MIME_DOCUMENTOS = [
  'application/pdf',
  'image/*',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.*',
]

export type Fichero = { data: Buffer; mimetype: string; name: string; size: number }

const esHeic = (f: Fichero) => /image\/hei[cf]/.test(f.mimetype) || /\.hei[cf]$/i.test(f.name)
const esImagenComprimible = (f: Fichero) => esHeic(f) || (/^image\//.test(f.mimetype) && !/svg|gif|webp/.test(f.mimetype))

export const MAX_IMAGEN = 50 * 1024 * 1024

/**
 * Compresión automática de imágenes (RF-22). Los PDF y los Office no se tocan.
 * Devuelve el fichero listo para guardar y, si la configuración lo pide, el original.
 */
export async function prepararFichero(file: Fichero, { sinComprimir = false } = {}) {
  if (file.size > MAX_IMAGEN) throw new AppError('El archivo supera el límite de 50 MB.', 413)
  if (sinComprimir || !esImagenComprimible(file)) return { file, tamanoOriginal: null as number | null, original: null as Fichero | null }
  const cfg = await leerConfiguracion()
  let entrada = file.data
  if (esHeic(file)) {
    const convertir = (await import('heic-convert')).default
    entrada = Buffer.from(await convertir({ buffer: file.data, format: 'JPEG', quality: 0.95 }))
  }
  const salida = await sharp(entrada).rotate().resize({ width: cfg.ladoMaximo, height: cfg.ladoMaximo, fit: 'inside', withoutEnlargement: true }).webp({ quality: cfg.calidad }).toBuffer()
  const base = path.parse(file.name).name
  return {
    file: { ...file, data: salida, mimetype: 'image/webp', name: `${base}.webp`, size: salida.length },
    tamanoOriginal: file.size,
    original: cfg.conservarOriginal ? file : null,
  }
}

export const tamano = (n?: number | null) => {
  if (!n) return '—'
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2).replace('.', ',')} GB`
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1).replace('.', ',')} MB`
  return `${Math.max(1, Math.round(n / 1024))} KB`
}
