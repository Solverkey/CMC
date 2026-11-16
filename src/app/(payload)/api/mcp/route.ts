import config from '@payload-config'
import { REST_GET, REST_POST } from '@payloadcms/next/routes'
import { urlServidor } from '@/lib/configuracion'

const post = REST_POST(config)
const get = REST_GET(config)
const params = { params: Promise.resolve({ slug: ['mcp'] }) }

/** Si falta o caduca el acceso, indica al asistente de IA dónde iniciar la autorización OAuth. */
const conCabeceraOAuth = async (res: Response) => {
  if (res.status !== 401) return res
  const headers = new Headers(res.headers)
  headers.set('WWW-Authenticate', `Bearer resource_metadata="${urlServidor()}/.well-known/oauth-protected-resource/api/mcp"`)
  return new Response(res.body, { status: 401, headers })
}

export const POST = async (req: Request) => conCabeceraOAuth(await post(req, params))
export const GET = async (req: Request) => conCabeceraOAuth(await get(req, params))
