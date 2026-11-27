import { esSuperAdmin } from '@/access'
import { AppError } from '@/lib/appError'
import { registrar } from '@/lib/actividad'
import { buscarEntrada, crearCatalogo, desactivarCatalogo, EFECTOS, listarCatalogoActivo, propagarNombre, usarNombre, type Efecto, type TipoCatalogo } from '@/lib/catalogo'
import type { Ctx } from '@/lib/ctx'
import { ahora, bit, ejecutar, filas, uno } from '@/lib/db'
import { normalizar } from '@/lib/texto'
import { categoriaPorId, empresaPorId } from '@/datos/consultas'
import { idDe } from '@/lib/payload'
import { leerConfiguracion } from '@/lib/configuracion'

/**
 * Edición de los selectores desde el propio formulario (sin ir a la página de Selectores):
 * instalaciones de una empresa y nombres de los catálogos (documentos y tipos de relación).
 */

export type OpcionSelector = { valor: string; texto: string; nota?: string }

function soloCmc(ctx: Ctx) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC puede cambiar los selectores.', 403)
}

const limpiar = (nombre: string) => {
  const n = nombre.replace(/\s+/g, ' ').trim()
  if (!n) throw new AppError('Escriba el nombre.')
  if (n.length > 200) throw new AppError('El nombre es demasiado largo.')
  return n
}

// ── Instalaciones de una empresa ──────────────────────────────────────────────

async function instalacionDuplicada(empresa: number, nombre: string, salvo?: number) {
  const rows = await filas<{ id: number; nombre: string; archivada: unknown }>('SELECT id, nombre, archivada FROM categorias WHERE empresa_id = $1', [empresa])
  return rows.find((r) => r.id !== salvo && normalizar(r.nombre) === normalizar(nombre)) ?? null
}

export async function crearInstalacion(ctx: Ctx, empresaId: number | string, nombre: string): Promise<OpcionSelector> {
  soloCmc(ctx)
  const empresa = await empresaPorId(empresaId)
  if (!empresa) throw new AppError('Empresa no encontrada.', 404)
  const n = limpiar(nombre)
  const ya = await instalacionDuplicada(Number(empresa.id), n)
  if (ya && !ya.archivada) throw new AppError(`${empresa.razonSocial} ya tiene la instalación «${ya.nombre}».`)
  if (ya) {
    // Estaba archivada: se recupera con su histórico en vez de duplicarla.
    await ejecutar('UPDATE categorias SET archivada = $2, updated_at = $3 WHERE id = $1', [ya.id, bit(false), ahora()])
    await registrar(ctx, { accion: 'edicion', descripcion: `Instalación «${ya.nombre}» desarchivada`, empresa: empresa.id, coleccion: 'categorias', registroId: ya.id })
    return { valor: String(ya.id), texto: ya.nombre }
  }
  const orden = (await uno<{ m: number | null }>('SELECT MAX(orden) AS m FROM categorias WHERE empresa_id = $1', [Number(empresa.id)]))?.m
  const c = await uno<{ id: number }>(
    `INSERT INTO categorias (nombre, empresa_id, orden, archivada, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
    [n, Number(empresa.id), Number(orden ?? -1) + 1, bit(false), ahora()],
  )
  await usarNombre(ctx, 'categoria', n)
  await registrar(ctx, { accion: 'alta', descripcion: `Instalación «${n}» creada en ${empresa.razonSocial}`, empresa: empresa.id, coleccion: 'categorias', registroId: c!.id })
  return { valor: String(c!.id), texto: n }
}

export async function renombrarInstalacion(ctx: Ctx, id: number | string, nombre: string): Promise<OpcionSelector> {
  soloCmc(ctx)
  const cat = await categoriaPorId(id)
  if (!cat) throw new AppError('Instalación no encontrada.', 404)
  const n = limpiar(nombre)
  if (n === cat.nombre) return { valor: String(cat.id), texto: n }
  const ya = await instalacionDuplicada(Number(idDe(cat.empresa)), n, Number(cat.id))
  if (ya) throw new AppError(`Ya hay una instalación «${ya.nombre}»${ya.archivada ? ' (archivada)' : ''} en esta empresa.`)
  await ejecutar('UPDATE categorias SET nombre = $2, updated_at = $3 WHERE id = $1', [Number(cat.id), n, ahora()])
  await moverNombreCatalogo(ctx, cat.nombre, n)
  await registrar(ctx, { accion: 'edicion', descripcion: `Instalación «${cat.nombre}» renombrada a «${n}»`, empresa: idDe(cat.empresa), coleccion: 'categorias', registroId: cat.id })
  return { valor: String(cat.id), texto: n }
}

const nombreEnUso = async (nombre: string) => Number((await uno<{ n: number }>('SELECT COUNT(*) AS n FROM categorias WHERE nombre = $1', [nombre]))?.n ?? 0) > 0

/** Tras renombrar: si el nombre viejo ya no lo usa nadie (p. ej. una errata), la entrada del catálogo pasa al nuevo. */
async function moverNombreCatalogo(ctx: Ctx, viejo: string, nuevo: string) {
  const entrada = await buscarEntrada(ctx, 'categoria', viejo)
  const yaNuevo = await buscarEntrada(ctx, 'categoria', nuevo)
  if (entrada && !yaNuevo && !(await nombreEnUso(viejo))) {
    await ejecutar('UPDATE catalogo SET nombre = $2, normalizado = $3, updated_at = $4 WHERE id = $1', [entrada.id, nuevo, normalizar(nuevo), ahora()])
  } else {
    await usarNombre(ctx, 'categoria', nuevo)
  }
}

/** Tras borrar una instalación: si nadie más usa el nombre, deja de sugerirse (se puede volver a crear). */
async function retirarNombreSinUso(ctx: Ctx, nombre: string) {
  const entrada = await buscarEntrada(ctx, 'categoria', nombre)
  if (entrada && entrada.activo !== false && !(await nombreEnUso(nombre))) await ejecutar('UPDATE catalogo SET activo = $2, updated_at = $3 WHERE id = $1', [entrada.id, bit(false), ahora()])
}

export async function documentosDeInstalacion(id: number | string) {
  const r = await uno<{ n: number }>('SELECT COUNT(*) AS n FROM documentos WHERE categoria_id = $1', [Number(id)])
  return Number(r?.n ?? 0)
}

/** Sin documentos se borra; con documentos se archiva (deja de salir, el histórico se conserva). */
export async function quitarInstalacion(ctx: Ctx, id: number | string): Promise<{ borrada: boolean; mensaje: string }> {
  soloCmc(ctx)
  const cat = await categoriaPorId(id)
  if (!cat) throw new AppError('Instalación no encontrada.', 404)
  const docs = await documentosDeInstalacion(cat.id)
  if (docs > 0) {
    await ejecutar('UPDATE categorias SET archivada = $2, updated_at = $3 WHERE id = $1', [Number(cat.id), bit(true), ahora()])
    await registrar(ctx, { accion: 'edicion', descripcion: `Instalación «${cat.nombre}» archivada`, empresa: idDe(cat.empresa), coleccion: 'categorias', registroId: cat.id })
    return { borrada: false, mensaje: `«${cat.nombre}» tiene ${docs} documento${docs === 1 ? '' : 's'}: se ha archivado y sus documentos se conservan.` }
  }
  await ejecutar('UPDATE envios SET categoria_destino_id = NULL WHERE categoria_destino_id = $1', [Number(cat.id)])
  await ejecutar('UPDATE hilos SET categoria_id = NULL WHERE categoria_id = $1', [Number(cat.id)])
  await ejecutar('DELETE FROM categorias WHERE id = $1', [Number(cat.id)])
  await retirarNombreSinUso(ctx, cat.nombre)
  await registrar(ctx, { accion: 'baja', descripcion: `Instalación «${cat.nombre}» borrada (no tenía documentos)`, empresa: idDe(cat.empresa), coleccion: 'categorias', registroId: cat.id })
  return { borrada: true, mensaje: `«${cat.nombre}» se ha borrado.` }
}

// ── Catálogos de nombres (documentos y tipos de relación) ─────────────────────

const ETIQUETA_EFECTO = new Map<string, string>(EFECTOS.map((e) => [e.value, e.label]))
const notaEfectos = (efectos?: string[] | null) => (efectos?.length ? efectos.map((e) => ETIQUETA_EFECTO.get(e) ?? e).join(', ') : undefined)

export async function opcionesCatalogo(ctx: Ctx, tipo: TipoCatalogo): Promise<OpcionSelector[]> {
  soloCmc(ctx)
  const lista = (await listarCatalogoActivo()).filter((o) => o.tipo === tipo)
  const opciones = lista.map((o) => ({ valor: o.nombre, texto: o.nombre, nota: tipo === 'relacion' ? notaEfectos(o.efectos) : undefined }))
  if (tipo !== 'categoria') return opciones
  // Para instalaciones, también los nombres que ya usan otras empresas y los de la plantilla.
  const vistos = new Set(opciones.map((o) => normalizar(o.texto)))
  const usados = await filas<{ nombre: string }>('SELECT DISTINCT nombre FROM categorias WHERE archivada IS NOT TRUE')
  const plantilla = (await leerConfiguracion()).plantillaCategorias.map((c) => ({ nombre: c.nombre }))
  for (const { nombre } of [...usados, ...plantilla]) {
    if (!nombre || vistos.has(normalizar(nombre))) continue
    vistos.add(normalizar(nombre))
    opciones.push({ valor: nombre, texto: nombre, nota: undefined })
  }
  return opciones.sort((a, b) => a.texto.localeCompare(b.texto, 'es'))
}

const USOS_SQL: Record<TipoCatalogo, string[]> = {
  categoria: ['SELECT COUNT(*) AS n FROM categorias WHERE nombre = $1'],
  documento: ['SELECT COUNT(*) AS n FROM documentos WHERE titulo = $1', 'SELECT COUNT(*) AS n FROM envios WHERE titulo = $1'],
  relacion: ['SELECT COUNT(*) AS n FROM archivos WHERE relacion = $1', 'SELECT COUNT(*) AS n FROM envios WHERE relacion = $1'],
}

/** Cuántos registros usan un nombre (para avisar antes de renombrarlo). */
export async function usosDeNombre(ctx: Ctx, tipo: TipoCatalogo, nombre: string) {
  soloCmc(ctx)
  let total = 0
  for (const sql of USOS_SQL[tipo]) total += Number((await uno<{ n: number }>(sql, [nombre]))?.n ?? 0)
  return total
}

export async function crearEnCatalogo(ctx: Ctx, tipo: TipoCatalogo, nombre: string, efectos?: string[]): Promise<OpcionSelector> {
  soloCmc(ctx)
  const n = limpiar(nombre)
  const validos = (efectos ?? []).filter((e): e is Efecto => EFECTOS.some((x) => x.value === e))
  await crearCatalogo(ctx, tipo, n, validos)
  const entrada = await buscarEntrada(ctx, tipo, n)
  return { valor: entrada?.nombre ?? n, texto: entrada?.nombre ?? n, nota: tipo === 'relacion' ? notaEfectos(entrada?.efectos ?? validos) : undefined }
}

/** Renombra la opción y el nombre en todo lo que ya lo usa, para que el catálogo siga siendo uno solo. */
export async function renombrarEnCatalogo(ctx: Ctx, tipo: TipoCatalogo, actual: string, nombre: string): Promise<OpcionSelector> {
  soloCmc(ctx)
  const n = limpiar(nombre)
  const entrada = await buscarEntrada(ctx, tipo, actual)
  if (!entrada) throw new AppError(`«${actual}» no está en el selector.`, 404)
  if (n === entrada.nombre) return { valor: n, texto: n, nota: tipo === 'relacion' ? notaEfectos(entrada.efectos) : undefined }
  const otra = await buscarEntrada(ctx, tipo, n)
  if (otra && String(otra.id) !== String(entrada.id)) throw new AppError(`Ya existe «${otra.nombre}» en el selector.`)
  await ejecutar('UPDATE catalogo SET nombre = $2, normalizado = $3, updated_at = $4 WHERE id = $1', [entrada.id, n, normalizar(n), ahora()])
  await propagarNombre(tipo, entrada.nombre, n)
  await registrar(ctx, { accion: 'edicion', descripcion: `Selector: «${entrada.nombre}» renombrado a «${n}»`, coleccion: 'catalogo', registroId: entrada.id })
  return { valor: n, texto: n, nota: tipo === 'relacion' ? notaEfectos(entrada.efectos) : undefined }
}

export async function quitarDeCatalogo(ctx: Ctx, tipo: TipoCatalogo, nombre: string) {
  soloCmc(ctx)
  const entrada = await buscarEntrada(ctx, tipo, nombre)
  if (!entrada) throw new AppError(`«${nombre}» no está en el selector.`, 404)
  await desactivarCatalogo(ctx, entrada.id)
  return { mensaje: `«${entrada.nombre}» ya no sale en el selector. Lo que ya lo usa no cambia.` }
}
