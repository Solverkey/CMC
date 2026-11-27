import { ahora, ejecutar, esPostgres, filas, uno } from '@/lib/db'

/**
 * Qué se ha hecho con cada archivo adjunto de una conversación: enviarlo a revisión (envío) o añadirlo a un
 * documento (archivo). La tabla la crea el código la primera vez, como `hilos_lecturas`; la API pública de
 * Supabase la cierra `cerrarApi.ts` igual que las demás.
 */

let lista: Promise<void> | null = null

export function asegurarDestinos() {
  lista ??= (async () => {
    const id = esPostgres ? 'serial PRIMARY KEY' : 'integer PRIMARY KEY'
    const fecha = esPostgres ? 'timestamp(3) with time zone' : 'text'
    await ejecutar(
      `CREATE TABLE IF NOT EXISTS adjuntos_destinos (id ${id}, adjunto_id integer NOT NULL, hilo_id integer, envio_id integer, archivo_id integer, creado_por_id integer, created_at ${fecha} NOT NULL)`,
    )
    await ejecutar('CREATE INDEX IF NOT EXISTS adjuntos_destinos_adjunto_idx ON adjuntos_destinos (adjunto_id)')
    await ejecutar('CREATE INDEX IF NOT EXISTS adjuntos_destinos_envio_idx ON adjuntos_destinos (envio_id)')
    // Cerrada a la API pública desde el primer momento (cerrarApi.ts lo repite en cada arranque).
    if (esPostgres) await ejecutar('ALTER TABLE adjuntos_destinos ENABLE ROW LEVEL SECURITY')
  })().catch((e) => {
    lista = null
    throw e
  })
  return lista
}

export async function anotarDestino(d: { adjunto: number; hilo?: number | null; envio?: number | null; archivo?: number | null; usuario?: number | null }) {
  await asegurarDestinos()
  await ejecutar('INSERT INTO adjuntos_destinos (adjunto_id, hilo_id, envio_id, archivo_id, creado_por_id, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [
    d.adjunto,
    d.hilo ?? null,
    d.envio ?? null,
    d.archivo ?? null,
    d.usuario ?? null,
    ahora(),
  ])
}

export type DestinoAdjunto = {
  envio?: { id: number; estado: string; documentoId: number | null; documentoTitulo: string | null; motivoRechazo: string | null }
  archivo?: { id: number; documentoId: number; documentoTitulo: string; relacion: string }
}

const lista_ = (ids: (number | string)[]) => [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))]

/** Estado de cada adjunto: en qué envío o en qué documento ha acabado. */
export async function destinosDeAdjuntos(ids: (number | string)[]): Promise<Map<number, DestinoAdjunto>> {
  const unicos = lista_(ids)
  const mapa = new Map<number, DestinoAdjunto>()
  if (!unicos.length) return mapa
  await asegurarDestinos()
  const rows = await filas<Record<string, unknown>>(
    `SELECT d.adjunto_id, d.envio_id, e.estado AS envio_estado, e.motivo_rechazo, e.documento_destino_id, de.titulo AS destino_titulo,
            d.archivo_id, a.documento_id AS archivo_documento, a.relacion, da.titulo AS archivo_titulo
       FROM adjuntos_destinos d
       LEFT JOIN envios e ON e.id = d.envio_id
       LEFT JOIN documentos de ON de.id = e.documento_destino_id
       LEFT JOIN archivos a ON a.id = d.archivo_id
       LEFT JOIN documentos da ON da.id = a.documento_id
      WHERE d.adjunto_id IN (${unicos.join(',')})
      ORDER BY d.id`,
  )
  for (const r of rows) {
    const k = Number(r.adjunto_id)
    const actual = mapa.get(k) ?? {}
    if (r.envio_id != null && r.envio_estado != null) {
      actual.envio = {
        id: Number(r.envio_id),
        estado: String(r.envio_estado),
        documentoId: r.documento_destino_id == null ? null : Number(r.documento_destino_id),
        documentoTitulo: r.destino_titulo == null ? null : String(r.destino_titulo),
        motivoRechazo: r.motivo_rechazo == null ? null : String(r.motivo_rechazo),
      }
    }
    if (r.archivo_id != null && r.archivo_documento != null) {
      actual.archivo = { id: Number(r.archivo_id), documentoId: Number(r.archivo_documento), documentoTitulo: String(r.archivo_titulo ?? ''), relacion: String(r.relacion ?? '') }
    }
    mapa.set(k, actual)
  }
  return mapa
}

/** Conversación de la que viene un envío (si se envió desde un adjunto). */
export async function conversacionDeEnvio(envioId: number | string) {
  await asegurarDestinos()
  return uno<{ hilo_id: number; asunto: string }>(
    'SELECT d.hilo_id, h.asunto FROM adjuntos_destinos d JOIN hilos h ON h.id = d.hilo_id WHERE d.envio_id = $1 LIMIT 1',
    [Number(envioId)],
  )
}

/** Conversación (y mensaje) donde está un adjunto. */
export async function hiloDeAdjunto(adjuntoId: number | string) {
  return uno<{ hilo_id: number; asunto: string; documento_id: number | null; empresa_id: number }>(
    `SELECT m.hilo_id, h.asunto, h.documento_id, h.empresa_id FROM mensajes_rels r JOIN mensajes m ON m.id = r.parent_id JOIN hilos h ON h.id = m.hilo_id
      WHERE r.adjuntos_id = $1 AND r.path = 'adjuntos' LIMIT 1`,
    [Number(adjuntoId)],
  )
}

export type AdjuntoDeDocumento = { id: number; filename: string; filesize: number | null; url: string | null; createdAt: string; autor: string | null; deCmc: boolean; hiloId: number; asunto: string }

/** Adjuntos de las conversaciones sobre un documento, del más reciente al más antiguo. */
export async function adjuntosDeDocumento(documentoId: number | string): Promise<AdjuntoDeDocumento[]> {
  const rows = await filas<Record<string, unknown>>(
    `SELECT a.id, a.filename, a.filesize, a.created_at, u.nombre, u.rol, h.id AS hilo_id, h.asunto
       FROM hilos h
       JOIN mensajes m ON m.hilo_id = h.id
       JOIN mensajes_rels r ON r.parent_id = m.id AND r.path = 'adjuntos'
       JOIN adjuntos a ON a.id = r.adjuntos_id
       LEFT JOIN users u ON u.id = a.subido_por_id
      WHERE h.documento_id = $1
      ORDER BY a.created_at DESC LIMIT 100`,
    [Number(documentoId)],
  )
  return rows.map((r) => ({
    id: Number(r.id),
    filename: String(r.filename ?? ''),
    filesize: r.filesize == null ? null : Number(r.filesize),
    url: r.filename ? `/api/ficheros/adjuntos/${encodeURIComponent(String(r.filename))}` : null,
    createdAt: String(r.created_at),
    autor: r.nombre == null ? null : String(r.nombre),
    deCmc: r.rol === 'superadmin',
    hiloId: Number(r.hilo_id),
    asunto: String(r.asunto ?? ''),
  }))
}

/** Conversación de la que salió cada archivo de un documento (si se añadió desde un adjunto). */
export async function conversacionesDeArchivos(archivoIds: (number | string)[]): Promise<Map<number, { hiloId: number; asunto: string }>> {
  const unicos = lista_(archivoIds)
  const mapa = new Map<number, { hiloId: number; asunto: string }>()
  if (!unicos.length) return mapa
  await asegurarDestinos()
  const rows = await filas<Record<string, unknown>>(
    `SELECT a.id AS archivo_id, d.hilo_id, h.asunto FROM archivos a
       JOIN adjuntos_destinos d ON d.archivo_id = a.id
       JOIN hilos h ON h.id = d.hilo_id
      WHERE a.id IN (${unicos.join(',')})`,
  )
  for (const r of rows) mapa.set(Number(r.archivo_id), { hiloId: Number(r.hilo_id), asunto: String(r.asunto ?? '') })
  return mapa
}

/** Al publicar un envío que vino de un adjunto, se anota el archivo resultante. */
export async function enlazarArchivoDeEnvio(envioId: number, archivoId: number) {
  await asegurarDestinos()
  await ejecutar('UPDATE adjuntos_destinos SET archivo_id = $2 WHERE envio_id = $1 AND archivo_id IS NULL', [envioId, archivoId])
}
