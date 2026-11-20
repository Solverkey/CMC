import crypto from 'crypto'
import { registrar } from '../lib/actividad'
import { hash, tokenAleatorio } from '../lib/cifrado'
import { indiceClave } from '../lib/clave'
import { urlServidor } from '../lib/configuracion'
import type { Ctx } from '../lib/ctx'
import { ahora, bit, bool, ejecutar, jsonParam, jsonSql, jsonValor, uno } from '../lib/db'
import { crearClave, renovarClave } from './claves'

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

export async function cuerpo(req: Request): Promise<Record<string, string>> {
  const texto = await req.text().catch(() => '')
  if (!texto) return {}
  if ((req.headers.get('content-type') ?? '').includes('json')) return JSON.parse(texto)
  return Object.fromEntries(new URLSearchParams(texto))
}

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

type Cliente = { id: number; clientId: string; nombre: string; redirectUris: string[]; bloqueado: boolean }

export async function clientePorId(clientId: string): Promise<Cliente | null> {
  const row = await uno<Record<string, unknown>>('SELECT * FROM oauth_clientes WHERE client_id = $1', [clientId])
  if (!row) return null
  const uris = (jsonValor(row.redirect_uris) as string[] | null) ?? []
  return { id: Number(row.id), clientId: String(row.client_id), nombre: String(row.nombre), redirectUris: uris, bloqueado: bool(row.bloqueado) }
}

export async function validarAutorizacion(p: Record<string, string | undefined>) {
  if (p.response_type !== 'code') return { error: 'Tipo de respuesta no admitido.' }
  if (!p.client_id) return { error: 'Falta el identificador de la aplicación.' }
  const cliente = await clientePorId(p.client_id)
  if (!cliente || cliente.bloqueado) return { error: 'Aplicación desconocida o bloqueada por CMC.' }
  if (!p.redirect_uri || !cliente.redirectUris.includes(p.redirect_uri)) return { error: 'La dirección de retorno no está registrada.' }
  if (!p.code_challenge || p.code_challenge_method !== 'S256') return { error: 'La aplicación debe usar PKCE (S256).' }
  return { cliente }
}

export async function registrarCliente(req: Request, ctx: Ctx) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const uris = Array.isArray(b.redirect_uris) ? (b.redirect_uris as string[]) : []
  if (!uris.length || uris.length > 10 || !uris.every(redireccionValida)) return errorOAuth('invalid_redirect_uri', 'Direcciones de retorno no válidas.')
  const nombre = String(b.client_name ?? 'Asistente de IA').slice(0, 100)
  const clientId = `cmc-${tokenAleatorio(18)}`
  await ejecutar(
    `INSERT INTO oauth_clientes (client_id, nombre, redirect_uris, bloqueado, updated_at, created_at) VALUES ($1,$2,${jsonSql(3)},$4,$5,$5)`,
    [clientId, nombre, jsonParam(uris), bit(false), ahora()],
  )
  await registrar(ctx, { accion: 'seguridad', descripcion: `Registrada la aplicación de IA «${nombre}»`, coleccion: 'oauth-clientes', registroId: clientId })
  return Response.json(
    { client_id: clientId, client_name: nombre, redirect_uris: uris, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none', client_id_issued_at: Math.floor(Date.now() / 1000) },
    { status: 201 },
  )
}

export async function autorizar(ctx: Ctx, p: Record<string, string>) {
  if (!ctx.user) return errorOAuth('access_denied', 'Inicie sesión en el portal.', 401)
  const v = await validarAutorizacion(p)
  if ('error' in v) return errorOAuth('invalid_request', v.error)
  const destino = new URL(p.redirect_uri!)
  if (p.state) destino.searchParams.set('state', p.state)
  if (p.decision !== 'permitir') {
    destino.searchParams.set('error', 'access_denied')
    return Response.json({ redirect: destino.toString() })
  }
  const codigo = tokenAleatorio(32)
  await ejecutar(
    `INSERT INTO oauth_codigos (hash, client_id, usuario_id, redirect_uri, code_challenge, caduca, usado, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
    [hash(codigo), p.client_id, ctx.user.id, p.redirect_uri, p.code_challenge, new Date(Date.now() + 10 * 60_000).toISOString(), bit(false), ahora()],
  )
  await registrar(ctx, { accion: 'seguridad', descripcion: `Autorizado el acceso de «${v.cliente.nombre}» al portal`, coleccion: 'oauth-clientes', registroId: v.cliente.clientId })
  destino.searchParams.set('code', codigo)
  return Response.json({ redirect: destino.toString() })
}

export async function token(req: Request, ctx: Ctx) {
  const p = await cuerpo(req).catch(() => ({}) as Record<string, string>)
  const cliente = p.client_id ? await clientePorId(p.client_id) : null
  if (!cliente || cliente.bloqueado) return errorOAuth('invalid_client', undefined, 401)

  if (p.grant_type === 'refresh_token') {
    try {
      const r = await renovarClave(ctx, p.refresh_token ?? '', cliente.clientId)
      return Response.json({ access_token: r.apiKey, token_type: 'Bearer', expires_in: r.expiresIn, refresh_token: r.renovacion, scope: 'portal' }, { headers: { 'Cache-Control': 'no-store' } })
    } catch {
      return errorOAuth('invalid_grant')
    }
  }
  if (p.grant_type !== 'authorization_code') return errorOAuth('unsupported_grant_type')

  const c = await uno<Record<string, unknown>>('SELECT * FROM oauth_codigos WHERE hash = $1', [hash(p.code ?? '')])
  if (!c || bool(c.usado) || new Date(String(c.caduca)) < new Date() || c.client_id !== cliente.clientId || c.redirect_uri !== p.redirect_uri) return errorOAuth('invalid_grant')
  const reto = crypto.createHash('sha256').update(p.code_verifier ?? '').digest('base64url')
  if (reto !== c.code_challenge) return errorOAuth('invalid_grant', 'PKCE no válido.')
  await ejecutar('UPDATE oauth_codigos SET usado = $2, updated_at = $3 WHERE id = $1', [c.id, bit(true), ahora()])
  const r = await crearClave(ctx, { usuario: Number(c.usuario_id), label: cliente.nombre, origen: 'oauth', clientId: cliente.clientId })
  return Response.json({ access_token: r.apiKey, token_type: 'Bearer', expires_in: r.expiresIn, refresh_token: r.renovacion, scope: 'portal' }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function revocar(req: Request) {
  const p = await cuerpo(req).catch(() => ({}) as Record<string, string>)
  if (p.token) {
    const k = await uno<{ id: number }>('SELECT id FROM payload_mcp_api_keys WHERE renovacion_hash = $1 OR api_key_index = $2 LIMIT 1', [hash(p.token), indiceClave(p.token)])
    if (k) await ejecutar('DELETE FROM payload_mcp_api_keys WHERE id = $1', [k.id])
  }
  return new Response(null, { status: 200 })
}
