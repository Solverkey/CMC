import type { PayloadRequest } from 'payload'
import { normalizar, parecidos } from './texto'

export type TipoCatalogo = 'categoria' | 'documento' | 'relacion'

export const EFECTOS = [
  { label: 'Sustituye al vigente', value: 'sustituye' },
  { label: 'Actualiza fechas', value: 'actualiza_fechas' },
  { label: 'Puede levantar la condición', value: 'levanta' },
  { label: 'Complementario', value: 'complementario' },
] as const

export type Efecto = (typeof EFECTOS)[number]['value']

/** Tipos de relación iniciales del catálogo (informe funcional, apartado 3). */
export const RELACIONES_INICIALES: { nombre: string; efectos: Efecto[] }[] = [
  { nombre: 'Original', efectos: ['sustituye'] },
  { nombre: 'Renovación', efectos: ['sustituye', 'actualiza_fechas'] },
  { nombre: 'Actualización', efectos: ['sustituye'] },
  { nombre: 'Subsanación', efectos: ['levanta'] },
  { nombre: 'Anexo', efectos: ['complementario'] },
]

/** Elementos que usan cada catálogo: al renombrar o fusionar se actualizan todos. */
export const USOS: Record<TipoCatalogo, { coleccion: 'categorias' | 'documentos' | 'archivos' | 'envios'; campo: string }[]> = {
  categoria: [{ coleccion: 'categorias', campo: 'nombre' }],
  documento: [
    { coleccion: 'documentos', campo: 'titulo' },
    { coleccion: 'envios', campo: 'titulo' },
  ],
  relacion: [
    { coleccion: 'archivos', campo: 'relacion' },
    { coleccion: 'envios', campo: 'relacion' },
  ],
}

export async function buscarEntrada(req: PayloadRequest, tipo: TipoCatalogo, nombre: string) {
  const { docs } = await req.payload.find({
    collection: 'catalogo',
    where: { and: [{ tipo: { equals: tipo } }, { normalizado: { equals: normalizar(nombre) } }] },
    limit: 20,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return docs.find((d) => d.nombre.trim().toLowerCase() === nombre.trim().toLowerCase()) ?? null
}

/** Suma un uso al nombre o lo añade al catálogo. Solo se llama al publicar (CMC), nunca desde un envío. */
export async function usarNombre(req: PayloadRequest, tipo: TipoCatalogo, nombre: string | null | undefined, extra: { efectos?: string[] | null } = {}) {
  const limpio = nombre?.trim()
  if (!limpio || req.context?.sinCatalogo) return
  const existente = await buscarEntrada(req, tipo, limpio)
  if (existente) {
    await req.payload.update({ collection: 'catalogo', id: existente.id, data: { usos: (existente.usos ?? 0) + 1 }, overrideAccess: true, req, context: { sinCatalogo: true } })
    return existente
  }
  return req.payload.create({
    collection: 'catalogo',
    data: { tipo, nombre: limpio, usos: 1, activo: true, ...(tipo === 'relacion' ? { efectos: (extra.efectos ?? ['complementario']) as Efecto[] } : {}) },
    overrideAccess: true,
    req,
    context: { sinCatalogo: true },
  })
}

export type Sugerencias = {
  opciones: { id: number | string; nombre: string; usos: number; efectos?: string[] | null }[]
  exacta: string | null
  similares: string[]
}

/**
 * Sugerencias para el campo con autocompletado (RF-28): sin texto, las más usadas; con texto, las que
 * coinciden sin distinguir mayúsculas ni acentos, por frecuencia. Para documentos se priorizan los nombres
 * ya usados en la misma categoría.
 */
export async function sugerir(req: PayloadRequest, tipo: TipoCatalogo, q = '', categoria?: string | null, limite = 12): Promise<Sugerencias> {
  const { docs } = await req.payload.find({
    collection: 'catalogo',
    where: { and: [{ tipo: { equals: tipo } }, { activo: { equals: true } }] },
    limit: 5000,
    depth: 0,
    sort: '-usos',
    overrideAccess: true,
    req,
  })
  const enCategoria = new Map<string, number>()
  if (tipo === 'documento' && categoria) {
    const cat = await req.payload.findByID({ collection: 'categorias', id: categoria, depth: 0, user: req.user, overrideAccess: false, req }).catch(() => null)
    if (cat) {
      const usados = await req.payload.find({ collection: 'documentos', where: { 'categoria.nombre': { equals: cat.nombre } }, select: { titulo: true }, limit: 2000, depth: 0, overrideAccess: true, req })
      for (const d of usados.docs) enCategoria.set(normalizar(d.titulo), (enCategoria.get(normalizar(d.titulo)) ?? 0) + 1)
    }
  }
  const nq = normalizar(q)
  const filtradas = docs
    .filter((d) => !nq || d.normalizado?.includes(nq) || normalizar(d.nombre).includes(nq))
    .sort((a, b) => (enCategoria.get(b.normalizado ?? '') ?? 0) - (enCategoria.get(a.normalizado ?? '') ?? 0) || (b.usos ?? 0) - (a.usos ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
  const exacta = q.trim() ? docs.find((d) => d.nombre.trim().toLowerCase() === q.trim().toLowerCase())?.nombre ?? null : null
  const similares = q.trim() && !exacta ? docs.filter((d) => parecidos(d.nombre, q)).map((d) => d.nombre).slice(0, 5) : []
  return {
    opciones: filtradas.slice(0, limite).map((d) => ({ id: d.id, nombre: d.nombre, usos: d.usos ?? 0, efectos: d.efectos })),
    exacta,
    similares,
  }
}

/** Efectos de un tipo de relación según el catálogo. */
export async function efectosDe(req: PayloadRequest, relacion: string): Promise<Efecto[] | null> {
  const e = await buscarEntrada(req, 'relacion', relacion)
  if (e?.efectos?.length) return e.efectos as Efecto[]
  return RELACIONES_INICIALES.find((r) => r.nombre.toLowerCase() === relacion.trim().toLowerCase())?.efectos ?? null
}
