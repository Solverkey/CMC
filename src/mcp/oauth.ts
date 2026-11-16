import crypto from 'crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { registrar } from '../lib/actividad'
import { hash, tokenAleatorio } from '../lib/cifrado'
import { urlServidor } from '../lib/configuracion'
import { crearClave, renovarClave } from './claves'

/**
 * OAuth 2.1 con PKCE para el servidor MCP (RF-27): el asistente de IA abre el portal, el usuario entra con
 * su cuenta y autoriza; el asistente recibe un acceso que actúa con los permisos de ese usuario.
 */
export const metadatosServidor = () => {
  const base = urlServidor()
  return {
    issuer: base,
    authorization_endpoint: `${base}/portal/oauth/autorizar`,
    token_endpoint: `${base}/api/oauth/token`,
    registration_endpoint: `${base}/api/oauth/registro`,
    revocation_endpoint: `${base}/api/oauth/revocar`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    scopes_supported: ['portal'],
  }
}

export const metadatosRecurso = () => ({
  resource: `${urlServidor()}/api/mcp`,
  authorization_servers: [urlServidor()],
  bearer_methods_supported: ['header'],
  scopes_supported: ['portal'],
  resource_name: 'Portal documental CMC',
})

const errorOAuth = (error: string, descripcion?: string, status = 400) => Response.json({ error, ...(descripcion ? { error_description: descripcion } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } })

async function cuerpo(req: PayloadRequest): Promise<Record<string, string>> {
  const texto = (await req.text?.().catch(() => '')) ?? ''
  if (!texto) return {}
  if ((req.headers.get('content-type') ?? '').includes('json')) return JSON.parse(texto)
  return Object.fromEntries(new URLSearchParams(texto))
}

/** Solo https, localhost o esquemas propios de aplicaciones de escritorio (cursor://, claude://…). */
const redireccionValida = (uri: string) => {
  try {
    const u = new URL(uri)
    if (u.protocol === 'https:') return true
    if (u.protocol === 'http:') return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
    return /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && !['javascript:', 'data:', 'file:', 'vbscript:'].includes(u.protocol)
  } catch {
    return false
  }
}

export async function clientePorId(req: PayloadRequest, clientId: string) {
  const { docs } = await req.payload.find({ collection: 'oauth-clientes', where: { clientId: { equals: clientId } }, limit: 1, depth: 0, overrideAccess: true, req })
  return docs[0] ?? null
}

/** Valida una solicitud de autorización (la usa la página de consentimiento del portal). */
export async function validarAutorizacion(req: PayloadRequest, p: Record<string, string | undefined>) {
  if (p.response_type !== 'code') return { error: 'Tipo de respuesta no admitido.' }
  if (!p.client_id) return { error: 'Falta el identificador de la aplicación.' }
  const cliente = await clientePorId(req, p.client_id)
  if (!cliente || cliente.bloqueado) return { error: 'Aplicación desconocida o bloqueada por CMC.' }
  const uris = (cliente.redirectUris as string[]) ?? []
  if (!p.redirect_uri || !uris.includes(p.redirect_uri)) return { error: 'La dirección de retorno no está registrada.' }
  if (!p.code_challenge || p.code_challenge_method !== 'S256') return { error: 'La aplicación debe usar PKCE (S256).' }
  return { cliente }
}

export const endpointsOAuth: Endpoint[] = [
  {
    // Registro dinámico de clientes (RFC 7591).
    path: '/oauth/registro',
    method: 'post',
    handler: async (req) => {
      const b = (await cuerpo(req).catch(() => ({}))) as Record<string, unknown>
      const uris = Array.isArray(b.redirect_uris) ? (b.redirect_uris as string[]) : []
      if (!uris.length || uris.length > 10 || !uris.every(redireccionValida)) return errorOAuth('invalid_redirect_uri', 'Direcciones de retorno no válidas.')
      const nombre = String(b.client_name ?? 'Asistente de IA').slice(0, 100)
      const clientId = `cmc-${tokenAleatorio(18)}`
      await req.payload.create({ collection: 'oauth-clientes', data: { clientId, nombre, redirectUris: uris }, overrideAccess: true, req })
      await registrar(req, { accion: 'seguridad', descripcion: `Registrada la aplicación de IA «${nombre}»`, coleccion: 'oauth-clientes', registroId: clientId })
      return Response.json(
        { client_id: clientId, client_name: nombre, redirect_uris: uris, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', client_id_issued_at: Math.floor(Date.now() / 1000) },
        { status: 201 },
      )
    },
  },
  {
    // Consentimiento del usuario con sesión iniciada en el portal → código de un solo uso.
    path: '/oauth/autorizar',
    method: 'post',
    handler: async (req) => {
      if (!req.user || req.user.collection !== 'users') return errorOAuth('access_denied', 'Inicie sesión en el portal.', 401)
      const p = await cuerpo(req)
      const v = await validarAutorizacion(req, p)
      if ('error' in v) return errorOAuth('invalid_request', v.error)
      const destino = new URL(p.redirect_uri!)
      if (p.state) destino.searchParams.set('state', p.state)
      if (p.decision !== 'permitir') {
        destino.searchParams.set('error', 'access_denied')
        return Response.json({ redirect: destino.toString() })
      }
      const codigo = tokenAleatorio(32)
      await req.payload.create({
        collection: 'oauth-codigos',
        overrideAccess: true,
        req,
        data: { hash: hash(codigo), clientId: p.client_id!, usuario: req.user.id as number, redirectUri: p.redirect_uri!, codeChallenge: p.code_challenge!, caduca: new Date(Date.now() + 10 * 60_000).toISOString() },
      })
      await registrar(req, { accion: 'seguridad', descripcion: `Autorizado el acceso de «${v.cliente.nombre}» al portal`, coleccion: 'oauth-clientes', registroId: v.cliente.clientId })
      destino.searchParams.set('code', codigo)
      return Response.json({ redirect: destino.toString() })
    },
  },
  {
    path: '/oauth/token',
    method: 'post',
    handler: async (req) => {
      const p = await cuerpo(req).catch(() => ({}) as Record<string, string>)
      const cliente = p.client_id ? await clientePorId(req, p.client_id) : null
      if (!cliente || cliente.bloqueado) return errorOAuth('invalid_client', undefined, 401)

      if (p.grant_type === 'refresh_token') {
        try {
          const r = await renovarClave(req, p.refresh_token ?? '', cliente.clientId)
          return Response.json({ access_token: r.apiKey, token_type: 'Bearer', expires_in: r.expiresIn, refresh_token: r.renovacion, scope: 'portal' }, { headers: { 'Cache-Control': 'no-store' } })
        } catch {
          return errorOAuth('invalid_grant')
        }
      }
      if (p.grant_type !== 'authorization_code') return errorOAuth('unsupported_grant_type')

      const { docs } = await req.payload.find({ collection: 'oauth-codigos', where: { hash: { equals: hash(p.code ?? '') } }, limit: 1, depth: 0, overrideAccess: true, req })
      const c = docs[0]
      if (!c || c.usado || new Date(c.caduca) < new Date() || c.clientId !== cliente.clientId || c.redirectUri !== p.redirect_uri) return errorOAuth('invalid_grant')
      const reto = crypto.createHash('sha256').update(p.code_verifier ?? '').digest('base64url')
      if (reto !== c.codeChallenge) return errorOAuth('invalid_grant', 'PKCE no válido.')
      await req.payload.update({ collection: 'oauth-codigos', id: c.id, data: { usado: true }, overrideAccess: true, req })
      const usuario = typeof c.usuario === 'object' ? c.usuario.id : c.usuario
      const r = await crearClave(req, { usuario, label: cliente.nombre, origen: 'oauth', clientId: cliente.clientId })
      return Response.json({ access_token: r.apiKey, token_type: 'Bearer', expires_in: r.expiresIn, refresh_token: r.renovacion, scope: 'portal' }, { headers: { 'Cache-Control': 'no-store' } })
    },
  },
  {
    path: '/oauth/revocar',
    method: 'post',
    handler: async (req) => {
      const p = await cuerpo(req).catch(() => ({}) as Record<string, string>)
      if (p.token) {
        const indice = crypto.createHmac('sha256', req.payload.secret).update(p.token).digest('hex')
        const { docs } = await req.payload.find({ collection: 'payload-mcp-api-keys', where: { or: [{ renovacionHash: { equals: hash(p.token) } }, { apiKeyIndex: { equals: indice } }] }, limit: 1, depth: 0, overrideAccess: true, req })
        if (docs[0]) await req.payload.delete({ collection: 'payload-mcp-api-keys', id: docs[0].id, overrideAccess: true, req })
      }
      return new Response(null, { status: 200 })
    },
  },
]
