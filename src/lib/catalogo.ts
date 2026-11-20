import { empresasDe, esSuperAdmin } from '@/access'
import { AppError } from '@/lib/appError'
import type { Ctx } from '@/lib/ctx'
import { ahora, bit, ejecutar, filas, uno } from '@/lib/db'
import { leerConfiguracion } from './configuracion'
import { normalizar, parecidos } from './texto'
import { mapCatalogo } from '@/datos/mapas'

export type TipoCatalogo = 'categoria' | 'documento' | 'relacion'
type Fila = Record<string, unknown>

export const EFECTOS = [
  { label: 'Sustituye al vigente', value: 'sustituye' },
  { label: 'Actualiza fechas', value: 'actualiza_fechas' },
  { label: 'Puede levantar la condición', value: 'levanta' },
  { label: 'Complementario', value: 'complementario' },
] as const

export type Efecto = (typeof EFECTOS)[number]['value']

export const RELACIONES_INICIALES: { nombre: string; efectos: Efecto[] }[] = [
  { nombre: 'Original', efectos: ['sustituye'] },
  { nombre: 'Renovación', efectos: ['sustituye', 'actualiza_fechas'] },
  { nombre: 'Actualización', efectos: ['sustituye'] },
  { nombre: 'Subsanación', efectos: ['levanta'] },
  { nombre: 'Anexo', efectos: ['complementario'] },
]

const USOS: Record<TipoCatalogo, { tabla: string; campo: string }[]> = {
  categoria: [{ tabla: 'categorias', campo: 'nombre' }],
  documento: [
    { tabla: 'documentos', campo: 'titulo' },
    { tabla: 'envios', campo: 'titulo' },
  ],
  relacion: [
    { tabla: 'archivos', campo: 'relacion' },
    { tabla: 'envios', campo: 'relacion' },
  ],
}

async function efectosDeFila(id: number) {
  const rows = await filas<{ value: Efecto }>(`SELECT value FROM catalogo_efectos WHERE parent_id = $1 ORDER BY "order"`, [id])
  return rows.map((r) => r.value)
}

export async function buscarEntrada(_req: Ctx, tipo: TipoCatalogo, nombre: string) {
  const rows = await filas<Fila>('SELECT * FROM catalogo WHERE tipo = $1 AND normalizado = $2 LIMIT 20', [tipo, normalizar(nombre)])
  const exacta = rows.find((d) => String(d.nombre).trim().toLowerCase() === nombre.trim().toLowerCase())
  if (!exacta) return null
  return mapCatalogo(exacta, await efectosDeFila(Number(exacta.id)))
}

export async function usarNombre(req: Ctx, tipo: TipoCatalogo, nombre: string | null | undefined, extra: { efectos?: string[] | null } = {}) {
  const limpio = nombre?.trim()
  if (!limpio || req.context?.sinCatalogo) return
  const existente = await buscarEntrada(req, tipo, limpio)
  if (existente) {
    await ejecutar('UPDATE catalogo SET usos = $2, updated_at = $3 WHERE id = $1', [existente.id, (existente.usos ?? 0) + 1, ahora()])
    return existente
  }
  const momento = ahora()
  const row = await uno<{ id: number }>(
    `INSERT INTO catalogo (tipo, nombre, usos, activo, normalizado, updated_at, created_at) VALUES ($1,$2,1,$3,$4,$5,$5) RETURNING id`,
    [tipo, limpio, bit(true), normalizar(limpio), momento],
  )
  if (tipo === 'relacion') {
    let orden = 1
    for (const valor of extra.efectos?.length ? extra.efectos : ['complementario']) {
      await ejecutar('INSERT INTO catalogo_efectos ("order", parent_id, value) VALUES ($1,$2,$3)', [orden++, row!.id, valor])
    }
  }
  return row
}

export type Sugerencias = {
  opciones: { id: number | string; nombre: string; usos: number; efectos?: string[] | null }[]
  exacta: string | null
  similares: string[]
}

export async function sugerir(req: Ctx, tipo: TipoCatalogo, q = '', categoria?: string | null, limite = 12): Promise<Sugerencias> {
  const rows = await filas<Fila>(`SELECT * FROM catalogo WHERE tipo = $1 AND activo IS NOT FALSE ORDER BY usos DESC LIMIT 5000`, [tipo])
  const todos = await Promise.all(rows.map(async (r) => mapCatalogo(r, await efectosDeFila(Number(r.id)))))
  const propios = esSuperAdmin(req.user) || tipo === 'relacion' ? null : await nombresPropios(req, tipo)
  const docs = propios ? todos.filter((d) => propios.has(d.normalizado ?? normalizar(d.nombre))) : todos
  const enCategoria = new Map<string, number>()
  if (tipo === 'documento' && categoria && req.user) {
    const cat = await uno<{ nombre: string }>('SELECT nombre FROM categorias WHERE id = $1', [Number(categoria)])
    if (cat) {
      const empresas = esSuperAdmin(req.user) ? '' : ` AND empresa_id IN (${empresasDe(req.user).map(Number).join(',') || 0})`
      const usados = await filas<{ titulo: string }>(`SELECT titulo FROM documentos WHERE categoria_id IN (SELECT id FROM categorias WHERE nombre = $1)${empresas} LIMIT 2000`, [cat.nombre])
      for (const d of usados) enCategoria.set(normalizar(d.titulo), (enCategoria.get(normalizar(d.titulo)) ?? 0) + 1)
    }
  }
  const nq = normalizar(q)
  const filtradas = docs
    .filter((d) => !nq || d.normalizado?.includes(nq) || normalizar(d.nombre).includes(nq))
    .sort((a, b) => (enCategoria.get(b.normalizado ?? '') ?? 0) - (enCategoria.get(a.normalizado ?? '') ?? 0) || (b.usos ?? 0) - (a.usos ?? 0) || a.nombre.localeCompare(b.nombre, 'es'))
  const exacta = q.trim() ? (docs.find((d) => d.nombre.trim().toLowerCase() === q.trim().toLowerCase())?.nombre ?? null) : null
  const similares = q.trim() && !exacta ? docs.filter((d) => parecidos(d.nombre, q)).map((d) => d.nombre).slice(0, 5) : []
  return {
    opciones: filtradas.slice(0, limite).map((d) => ({ id: d.id, nombre: d.nombre, usos: d.usos ?? 0, efectos: d.efectos })),
    exacta,
    similares,
  }
}

async function nombresPropios(req: Ctx, tipo: 'categoria' | 'documento') {
  const empresas = empresasDe(req.user).map(Number)
  const nombres = new Set<string>()
  if (!empresas.length) return nombres
  const lista = empresas.join(',')
  if (tipo === 'documento') {
    const docs = await filas<{ titulo: string }>(`SELECT titulo FROM documentos WHERE empresa_id IN (${lista})`)
    for (const d of docs) nombres.add(normalizar(d.titulo))
  } else {
    const cats = await filas<{ nombre: string }>(`SELECT nombre FROM categorias WHERE empresa_id IN (${lista})`)
    for (const c of cats) nombres.add(normalizar(c.nombre))
    for (const c of (await leerConfiguracion()).plantillaCategorias) nombres.add(normalizar(c.nombre))
  }
  return nombres
}

export async function efectosDe(req: Ctx, relacion: string): Promise<Efecto[] | null> {
  const e = await buscarEntrada(req, 'relacion', relacion)
  if (e?.efectos?.length) return e.efectos as Efecto[]
  return RELACIONES_INICIALES.find((r) => r.nombre.toLowerCase() === relacion.trim().toLowerCase())?.efectos ?? null
}

export async function crearCatalogo(ctx: Ctx, tipo: TipoCatalogo, nombre: string, efectos?: Efecto[]) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC.', 403)
  const limpio = nombre.trim()
  const ya = await buscarEntrada(ctx, tipo, limpio)
  if (ya) throw new AppError(`Ya existe «${ya.nombre}» en este catálogo.`)
  if (tipo === 'relacion' && !efectos?.length) throw new AppError('Indique el efecto del nuevo tipo de relación.')
  return usarNombre(ctx, tipo, limpio, { efectos })
}

export async function desactivarCatalogo(ctx: Ctx, id: number | string) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC.', 403)
  await ejecutar('UPDATE catalogo SET activo = $2, updated_at = $3 WHERE id = $1', [Number(id), bit(false), ahora()])
}

export async function propagarNombre(tipo: TipoCatalogo, de: string, a: string) {
  for (const { tabla, campo } of USOS[tipo]) {
    await ejecutar(`UPDATE ${tabla} SET ${campo} = $2, updated_at = $3 WHERE ${campo} = $1`, [de, a, ahora()])
  }
}

export async function listarCatalogoActivo() {
  const rows = await filas<Fila>(`SELECT * FROM catalogo WHERE activo IS NOT FALSE ORDER BY nombre LIMIT 500`)
  return Promise.all(rows.map(async (r) => mapCatalogo(r, await efectosDeFila(Number(r.id)))))
}
