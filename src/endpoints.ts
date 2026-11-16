import type { Endpoint, PayloadRequest } from 'payload'
import { APIError } from 'payload'
import { esSuperAdmin } from './access'
import { leerConfiguracion } from './lib/configuracion'
import { almacenamiento } from './lib/estadisticas'
import { crearClave } from './mcp/claves'
import { endpointsOAuth } from './mcp/oauth'
import { adjuntoAEnvio, exportarHistorial } from './servicios/comunicacion'
import { descargable, inventario, resolverEnlace, zipDocumentos } from './servicios/documentos'

const json = async (req: PayloadRequest) => ((await req.json?.().catch(() => ({}))) ?? {}) as Record<string, any>

const error = (e: unknown) => {
  const err = e as APIError
  return Response.json({ errors: [{ message: err.message }] }, { status: err.status ?? 500 })
}

const conSesion = (fn: (req: PayloadRequest) => Promise<Response>) => async (req: PayloadRequest) => {
  if (!req.user || req.user.collection !== 'users') return Response.json({ errors: [{ message: 'No autenticado.' }] }, { status: 401 })
  try {
    return await fn(req)
  } catch (e) {
    return error(e)
  }
}

export const endpoints: Endpoint[] = [
  {
    // Enlaces temporales firmados (ficheros, ZIP, inventario, historial).
    path: '/descarga',
    method: 'get',
    handler: async (req) => {
      try {
        const t = new URL(req.url ?? 'http://x').searchParams.get('t') ?? ''
        return descargable(await resolverEnlace(req, t, exportarHistorial))
      } catch (e) {
        return error(e)
      }
    },
  },
  {
    path: '/zip',
    method: 'post',
    handler: conSesion(async (req) => {
      const b = await json(req)
      const ids = (Array.isArray(b.ids) ? b.ids : String(b.ids ?? '').split(',')).filter(Boolean)
      return descargable({ data: await zipDocumentos(req, ids, Boolean(b.historico)), nombre: `Documentos ${new Date().toISOString().slice(0, 10)}.zip`, mime: 'application/zip' })
    }),
  },
  {
    path: '/inventario/:empresa',
    method: 'get',
    handler: conSesion(async (req) => {
      const formato = new URL(req.url ?? 'http://x').searchParams.get('formato') === 'pdf' ? 'pdf' : 'xlsx'
      return descargable(await inventario(req, req.routeParams!.empresa as string, formato))
    }),
  },
  {
    path: '/comunicaciones/:empresa',
    method: 'get',
    handler: conSesion(async (req) => {
      const documento = new URL(req.url ?? 'http://x').searchParams.get('documento')
      return descargable(await exportarHistorial(req, { empresa: req.routeParams!.empresa as string, documento }))
    }),
  },
  {
    path: '/adjuntos/:id/enviar-a-revision',
    method: 'post',
    handler: conSesion(async (req) => {
      const b = await json(req)
      const envio = await adjuntoAEnvio(req, { adjunto: req.routeParams!.id as string, titulo: b.titulo, documentoRelacionado: b.documento, relacion: b.relacion, nuevaCaducidad: b.nuevaCaducidad })
      return Response.json({ id: envio.id })
    }),
  },
  {
    path: '/almacenamiento',
    method: 'get',
    handler: conSesion(async (req) => {
      if (!esSuperAdmin(req.user)) throw new APIError('Solo CMC.', 403, null, true)
      const [uso, cfg] = await Promise.all([almacenamiento(req.payload), leerConfiguracion(req.payload, req)])
      return Response.json({ ...uso, limite: cfg.limiteGB * 1024 ** 3, avisoPorcentaje: cfg.avisoPorcentaje })
    }),
  },
  {
    // Clave de acceso para asistentes de IA que no admiten OAuth. Se muestra una sola vez.
    path: '/mcp-claves',
    method: 'post',
    handler: conSesion(async (req) => {
      const b = await json(req)
      const dias = Math.min(Math.max(Number(b.dias) || 90, 1), 365)
      const r = await crearClave(req, { usuario: req.user!.id, label: String(b.nombre || 'Asistente de IA').slice(0, 80), origen: 'manual', dias })
      return Response.json({ id: r.id, clave: r.apiKey })
    }),
  },
  ...endpointsOAuth,
]
