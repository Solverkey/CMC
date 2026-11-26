// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/datos/tipos'

// El servidor MCP se prueba sin base de datos: la clave se resuelve a un usuario de prueba.
const usuarios: Record<string, User> = {}
vi.mock('@/mcp/claves', () => ({ usuarioDeClave: async (clave: string) => (usuarios[clave] ? { user: usuarios[clave], clave: {} } : null) }))
vi.mock('@/lib/payload', async (original) => ({
  ...(await original<typeof import('@/lib/payload')>()),
  empresasDelUsuario: async () => ({ empresas: [], empresa: null }),
}))

const { herramientas, herramientasPara, puedeUsar } = await import('@/mcp/herramientas')
const { POST, GET, VERSIONES } = await import('@/app/api/mcp/route')

const persona = (p: Partial<User>): User => ({ id: 1, nombre: 'Prueba', email: 'p@test', rol: 'cliente', collection: 'users', updatedAt: '', createdAt: '', activo: true, ...p }) as User
const cmc = persona({ id: 1, rol: 'superadmin', totpActivo: true })
const cmcSin2FA = persona({ id: 2, rol: 'superadmin', totpActivo: false })
const admin = persona({ id: 3, empresas: [{ empresa: 10, rol: 'admin' }] })
const usuario = persona({ id: 4, empresas: [{ empresa: 10, rol: 'usuario' }] })
const sinEmpresas = persona({ id: 5, empresas: [] })

const nombres = (u: User) => herramientasPara(u).map((h) => h.name)

const llamar = (cuerpo: unknown, clave?: string) =>
  POST(new Request('http://localhost/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(clave ? { Authorization: `Bearer ${clave}` } : {}) }, body: JSON.stringify(cuerpo) }))

beforeEach(() => {
  delete process.env.CMC_2FA_SUPERADMIN
  Object.assign(usuarios, { 'k-cmc': cmc, 'k-admin': admin, 'k-usuario': usuario })
})

describe('MCP: herramientas según el rol', () => {
  it('cada herramienta tiene nombre único, título y nivel de acceso', () => {
    expect(new Set(herramientas.map((h) => h.name)).size).toBe(herramientas.length)
    for (const h of herramientas) {
      expect(h.title, h.name).toBeTruthy()
      expect(['todos', 'admin', 'cmc']).toContain(h.acceso)
    }
  })

  it('CMC ve todas; el administrador, las suyas y las de administración; el usuario, solo las comunes', () => {
    expect(nombres(cmc)).toHaveLength(herramientas.length)
    expect(nombres(admin)).toEqual(expect.arrayContaining(['usuarios_de_empresa', 'registro_actividad', 'dar_de_alta_usuario', 'buscar_documentos']))
    expect(nombres(admin)).not.toContain('alta_empresa')
    expect(nombres(usuario)).toEqual(expect.arrayContaining(['quien_soy', 'resumen', 'buscar_documentos', 'listar_conversaciones', 'escribir_mensaje', 'enviar_documento_a_cmc']))
    for (const n of ['registro_actividad', 'usuarios_de_empresa', 'alta_empresa', 'publicar_envio', 'almacenamiento', 'personal_cmc']) expect(nombres(usuario)).not.toContain(n)
  })

  it('un super administrador sin doble factor no tiene las herramientas de CMC', () => {
    expect(puedeUsar(cmcSin2FA, 'cmc')).toBe(false)
    process.env.CMC_2FA_SUPERADMIN = 'opcional'
    expect(puedeUsar(cmcSin2FA, 'cmc')).toBe(true)
  })

  it('sin empresas ni usuario no hay herramientas', () => {
    expect(nombres(sinEmpresas)).toEqual([])
    expect(herramientasPara(null)).toEqual([])
  })

  it('la herramienta comprueba el rol aunque se llame directamente', async () => {
    const alta = herramientas.find((h) => h.name === 'alta_empresa')!
    const r = await alta.handler({ razonSocial: 'X', cif: 'X', adminEmail: 'a@b.c' }, { user: usuario, headers: new Headers(), origen: 'mcp', context: {} }, null)
    expect(r.isError).toBe(true)
    expect(r.content[0].text).toMatch(/permiso/)
  })
})

describe('MCP: protocolo', () => {
  it('sin clave responde 401 e indica dónde autorizarse', async () => {
    const res = await llamar({ jsonrpc: '2.0', id: 1, method: 'ping' })
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toMatch(/resource_metadata=".*\/\.well-known\/oauth-protected-resource\/api\/mcp"/)
  })

  it('una clave caducada pide renovar el token', async () => {
    const res = await llamar({ jsonrpc: '2.0', id: 1, method: 'ping' }, 'caducada')
    expect(res.status).toBe(401)
    expect(res.headers.get('WWW-Authenticate')).toContain('invalid_token')
  })

  it('negocia la versión del protocolo e incluye instrucciones con el rol', async () => {
    const r = await (await llamar({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, 'k-usuario')).json()
    expect(r.result.protocolVersion).toBe('2025-03-26')
    expect(r.result.instructions).toContain('Usuario de empresa')
    const r2 = await (await llamar({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, 'k-usuario')).json()
    expect(r2.result.protocolVersion).toBe(VERSIONES[0])
  })

  it('las notificaciones reciben 202 sin cuerpo', async () => {
    const res = await llamar({ jsonrpc: '2.0', method: 'notifications/initialized' }, 'k-usuario')
    expect(res.status).toBe(202)
    expect(await res.text()).toBe('')
  })

  it('tools/list solo enseña las herramientas del rol, con anotaciones', async () => {
    const r = await (await llamar({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, 'k-usuario')).json()
    const lista = r.result.tools as { name: string; annotations: { readOnlyHint: boolean } }[]
    expect(lista.map((t) => t.name)).not.toContain('alta_empresa')
    expect(lista.find((t) => t.name === 'buscar_documentos')?.annotations.readOnlyHint).toBe(true)
    expect(lista.find((t) => t.name === 'escribir_mensaje')?.annotations.readOnlyHint).toBe(false)
  })

  it('una herramienta de otro rol se trata como desconocida', async () => {
    const r = await (await llamar({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'alta_empresa', arguments: {} } }, 'k-usuario')).json()
    expect(r.id).toBe(7)
    expect(r.error.code).toBe(-32602)
  })

  it('argumentos no válidos devuelven isError', async () => {
    const r = await (await llamar({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'ver_documento', arguments: {} } }, 'k-usuario')).json()
    expect(r.result.isError).toBe(true)
  })

  it('acepta lotes y JSON roto da error de análisis', async () => {
    const lote = await (await llamar([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }], 'k-usuario')).json()
    expect(lote).toHaveLength(1)
    const roto = await POST(new Request('http://localhost/api/mcp', { method: 'POST', headers: { Authorization: 'Bearer k-usuario' }, body: '{' }))
    expect(roto.status).toBe(400)
    expect((await roto.json()).error.code).toBe(-32700)
  })

  it('GET no abre flujo de eventos', () => {
    expect(GET().status).toBe(405)
  })
})
