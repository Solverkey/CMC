import { z } from 'zod'
import { herramientas } from '@/mcp/herramientas'
import { usuarioDeClave } from '@/mcp/claves'
import { metadatosRecurso } from '@/mcp/oauth'
import type { Ctx } from '@/lib/ctx'
import { AppError } from '@/lib/appError'

export const dynamic = 'force-dynamic'

const rpc = (id: unknown, result: unknown) => Response.json({ jsonrpc: '2.0', id, result })
const fallo = (id: unknown, code: number, message: string) => Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { status: code === -32600 ? 400 : 200 })

export async function GET() {
  return Response.json(metadatosRecurso(), { headers: { 'WWW-Authenticate': 'Bearer' } })
}

export async function POST(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const clave = auth.replace(/^Bearer\s+/i, '').trim()
  if (!clave) return new Response('No autorizado', { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } })
  let acceso: Awaited<ReturnType<typeof usuarioDeClave>>
  try {
    acceso = await usuarioDeClave(clave)
  } catch (e) {
    const err = e as AppError
    return Response.json({ error: err.message }, { status: err.status ?? 401 })
  }
  if (!acceso) return new Response('Clave no válida', { status: 401 })

  const cuerpo = (await req.json().catch(() => null)) as { id?: unknown; method?: string; params?: Record<string, unknown> } | null
  if (!cuerpo?.method) return fallo(null, -32600, 'Petición JSON-RPC no válida.')
  const ctx: Ctx = { user: acceso.user, headers: req.headers, origen: 'mcp', context: {} }

  if (cuerpo.method === 'initialize') {
    return rpc(cuerpo.id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'cmc-portal', version: '1.0.0' } })
  }
  if (cuerpo.method === 'tools/list') {
    return rpc(cuerpo.id, {
      tools: herramientas.map((h) => ({ name: h.name, description: h.description, inputSchema: z.toJSONSchema(z.object(h.parameters)) })),
    })
  }
  if (cuerpo.method === 'tools/call') {
    const nombre = String(cuerpo.params?.name ?? '')
    const herramienta = herramientas.find((h) => h.name === nombre)
    if (!herramienta) return fallo(cuerpo.id, -32602, 'Herramienta desconocida.')
    const args = (cuerpo.params?.arguments ?? {}) as Record<string, unknown>
    const parsed = z.object(herramienta.parameters).safeParse(args)
    if (!parsed.success) return rpc(cuerpo.id, { content: [{ type: 'text', text: `Error: ${parsed.error.issues[0]?.message ?? 'Argumentos no válidos.'}` }], isError: true })
    const result = await herramienta.handler(parsed.data, ctx, null)
    return rpc(cuerpo.id, result)
  }
  if (cuerpo.method === 'notifications/initialized' || cuerpo.method === 'ping') return rpc(cuerpo.id, {})
  return fallo(cuerpo.id, -32601, 'Método no disponible.')
}
