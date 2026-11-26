import { z } from 'zod'
import { herramientasPara, perfilDe } from '@/mcp/herramientas'
import { usuarioDeClave } from '@/mcp/claves'
import { urlServidor } from '@/lib/configuracion'
import type { Ctx } from '@/lib/ctx'
import { AppError } from '@/lib/appError'

export const dynamic = 'force-dynamic'

/**
 * Servidor MCP del portal (transporte «Streamable HTTP» sin flujo SSE: cada petición POST recibe su respuesta JSON).
 * El asistente actúa con el usuario de la clave: ve solo las herramientas de su rol y solo los datos de sus empresas.
 */

/** Versiones del protocolo que entiende el servidor, de la más nueva a la más antigua. */
export const VERSIONES = ['2025-06-18', '2025-03-26', '2024-11-05']

type Mensaje = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> }

const resultado = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result })
const error = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

/** Cabecera para que el cliente descubra cómo autorizarse (RFC 9728). */
const desafio = (extra = '') => `Bearer resource_metadata="${urlServidor()}/.well-known/oauth-protected-resource/api/mcp"${extra}`

const noAutorizado = (mensaje: string, extra = '') =>
  Response.json(error(null, -32001, mensaje), { status: 401, headers: { 'WWW-Authenticate': desafio(extra) } })

function instrucciones(perfil: Awaited<ReturnType<typeof perfilDe>>) {
  return [
    `Portal documental de CMC. Está conectado como ${perfil.nombre} (${perfil.email}). Rol: ${perfil.rol}.`,
    'Solo verá datos de las empresas a las que tiene acceso este usuario; las herramientas disponibles dependen de su rol.',
    'Empiece por quien_soy o resumen. Use mis_empresas para obtener los ids de empresa y listar_categorias para las categorías.',
    'Estados de los documentos: verde (vigente), amarillo (caducidad próxima), naranja (condicionada), rojo (caducado), azul (pasado o archivado), negro (no legalizado).',
    'Las acciones importantes piden confirmar=true: pregunte antes al usuario. Todo lo que haga queda en el registro de actividad con origen «Asistente de IA».',
    'Los enlaces de descarga caducan a los 10 minutos: genérelos justo cuando el usuario los vaya a usar.',
  ].join('\n')
}

async function atender(m: Mensaje, ctx: Ctx): Promise<object | null> {
  // Las notificaciones (sin id) no tienen respuesta.
  const esNotificacion = m.id === undefined
  if (!m || typeof m.method !== 'string') return esNotificacion ? null : error(m?.id, -32600, 'Petición JSON-RPC no válida.')
  if (esNotificacion) return null

  switch (m.method) {
    case 'initialize': {
      const pedida = String(m.params?.protocolVersion ?? '')
      const perfil = await perfilDe(ctx.user!)
      return resultado(m.id, {
        protocolVersion: VERSIONES.includes(pedida) ? pedida : VERSIONES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'cmc-portal', title: 'Portal documental CMC', version: '1.1.0' },
        instructions: instrucciones(perfil),
      })
    }
    case 'ping':
      return resultado(m.id, {})
    case 'tools/list':
      return resultado(m.id, {
        tools: herramientasPara(ctx.user).map((h) => ({
          name: h.name,
          title: h.title,
          description: h.description,
          inputSchema: z.toJSONSchema(z.object(h.parameters)),
          annotations: { title: h.title, readOnlyHint: h.soloLectura, destructiveHint: !h.soloLectura && Boolean(h.destructiva), openWorldHint: false },
        })),
      })
    case 'tools/call': {
      const nombre = String(m.params?.name ?? '')
      // Una herramienta de otro rol se trata como inexistente: no se revela qué hay detrás.
      const herramienta = herramientasPara(ctx.user).find((h) => h.name === nombre)
      if (!herramienta) return error(m.id, -32602, `Herramienta desconocida: ${nombre}`)
      const parsed = z.object(herramienta.parameters).safeParse(m.params?.arguments ?? {})
      if (!parsed.success) {
        const fallo = parsed.error.issues[0]
        return resultado(m.id, { content: [{ type: 'text', text: `Error: ${fallo ? `${fallo.path.join('.') || 'argumentos'}: ${fallo.message}` : 'Argumentos no válidos.'}` }], isError: true })
      }
      return resultado(m.id, await herramienta.handler(parsed.data, ctx, null))
    }
    case 'resources/list':
      return resultado(m.id, { resources: [] })
    case 'prompts/list':
      return resultado(m.id, { prompts: [] })
    default:
      return error(m.id, -32601, `Método no disponible: ${m.method}`)
  }
}

export async function POST(req: Request) {
  const clave = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!clave) return noAutorizado('Falta la autorización. Conecte el asistente desde el portal.')
  let acceso: Awaited<ReturnType<typeof usuarioDeClave>>
  try {
    acceso = await usuarioDeClave(clave)
  } catch (e) {
    const err = e as AppError
    return Response.json(error(null, -32000, err.message), { status: err.status ?? 500 })
  }
  // Clave caducada o revocada: el cliente debe renovar el token (OAuth) o pedir una clave nueva.
  if (!acceso) return noAutorizado('Acceso caducado o revocado.', ', error="invalid_token"')

  let cuerpo: unknown
  try {
    cuerpo = await req.json()
  } catch {
    return Response.json(error(null, -32700, 'El cuerpo no es JSON válido.'), { status: 400 })
  }
  const ctx: Ctx = { user: acceso.user, headers: req.headers, origen: 'mcp', context: {} }

  // Lotes (versión 2025-03-26): se responde a cada petición; si todo eran notificaciones, 202 sin cuerpo.
  if (Array.isArray(cuerpo)) {
    if (!cuerpo.length) return Response.json(error(null, -32600, 'Lote vacío.'), { status: 400 })
    const respuestas = (await Promise.all(cuerpo.map((m) => atender(m as Mensaje, ctx)))).filter(Boolean)
    return respuestas.length ? Response.json(respuestas) : new Response(null, { status: 202 })
  }
  const respuesta = await atender(cuerpo as Mensaje, ctx)
  return respuesta ? Response.json(respuesta) : new Response(null, { status: 202 })
}

/** Sin flujo de eventos del servidor: el cliente usa solo POST. */
export function GET() {
  return new Response('Use POST para hablar con el servidor MCP.', { status: 405, headers: { Allow: 'POST' } })
}

/** No hay sesiones que cerrar: el servidor no guarda estado entre peticiones. */
export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } })
}
