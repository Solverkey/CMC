// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import config from '@/payload.config'
import { cifrar } from '@/lib/cifrado'
import { codigo, nuevoSecreto } from '@/lib/totp'
import type { User } from '@/payload-types'
import { comprobarCodigoLogin } from '@/servicios/seguridad'

/** Aislamiento de datos entre empresas y reglas de permisos, contra una base de datos de pruebas (tests/.cmc-test.db). */
let payload: Payload
let ana: User
let bea: User
let cmc: User
const ids: Record<string, number> = {}
const ctx = { sinInvitacion: true, sinAdminInicial: true, sinAvisos: true }
const como = (user: User) => ({ user: { ...user, collection: 'users' } as never, overrideAccess: false as const })

beforeAll(async () => {
  payload = await getPayload({ config })
  for (const c of ['actividad', 'correos', 'documentos', 'categorias', 'catalogo'] as const) await payload.delete({ collection: c, where: { id: { exists: true } }, overrideAccess: true }).catch(() => null)
  await payload.db.deleteMany({ collection: 'users', where: {} })
  await payload.db.deleteMany({ collection: 'empresas', where: {} })

  const e1 = await payload.create({ collection: 'empresas', data: { razonSocial: 'Uno', cif: 'B1', aplicarPlantilla: false } as never, context: ctx })
  const e2 = await payload.create({ collection: 'empresas', data: { razonSocial: 'Dos', cif: 'B2', aplicarPlantilla: false } as never, context: ctx })
  ids.e1 = e1.id
  ids.e2 = e2.id
  const pw = 'ClaveSegura2026'
  ana = (await payload.create({ collection: 'users', data: { email: 'ana@uno.test', password: pw, nombre: 'Ana', rol: 'cliente', empresas: [{ empresa: e1.id, rol: 'admin' }] }, context: ctx })) as User
  bea = (await payload.create({ collection: 'users', data: { email: 'bea@dos.test', password: pw, nombre: 'Bea', rol: 'cliente', empresas: [{ empresa: e2.id, rol: 'usuario' }] }, context: ctx })) as User
  cmc = (await payload.create({ collection: 'users', data: { email: 'tec@cmc.test', password: pw, nombre: 'Técnico', rol: 'superadmin' }, context: ctx })) as User
  for (const [k, e] of [['c1', e1], ['c2', e2]] as const) ids[k] = (await payload.create({ collection: 'categorias', data: { nombre: `Cat ${k}`, empresa: e.id }, context: ctx })).id
  ids.d1 = (await payload.create({ collection: 'documentos', data: { titulo: 'Doc uno', empresa: e1.id, categoria: ids.c1, fechaCaducidad: '2030-01-01' }, context: ctx })).id
  ids.d2 = (await payload.create({ collection: 'documentos', data: { titulo: 'Doc dos', empresa: e2.id, categoria: ids.c2, fechaCaducidad: '2030-01-01' }, context: ctx })).id
})

afterAll(() => {
  delete process.env.CMC_2FA_SUPERADMIN
})

describe('aislamiento entre empresas', () => {
  it('cada usuario solo ve los documentos de sus empresas', async () => {
    const a = await payload.find({ collection: 'documentos', ...como(ana) })
    expect(a.docs.map((d) => d.id)).toEqual([ids.d1])
    const b = await payload.find({ collection: 'documentos', ...como(bea) })
    expect(b.docs.map((d) => d.id)).toEqual([ids.d2])
    await expect(payload.findByID({ collection: 'documentos', id: ids.d2, ...como(ana) })).rejects.toThrow()
  })

  it('un cliente no publica documentos ni crea categorías', async () => {
    await expect(payload.create({ collection: 'documentos', data: { titulo: 'x', empresa: ids.e1, categoria: ids.c1 }, ...como(ana) })).rejects.toThrow()
    await expect(payload.update({ collection: 'documentos', id: ids.d1, data: { titulo: 'cambiado' }, ...como(ana) })).rejects.toThrow()
    await expect(payload.create({ collection: 'categorias', data: { nombre: 'x', empresa: ids.e1 }, ...como(ana) })).rejects.toThrow()
  })

  it('un cliente no puede darse permisos ni empresas', async () => {
    const u = await payload.update({ collection: 'users', id: ana.id, data: { rol: 'superadmin', empresas: [{ empresa: ids.e2, rol: 'admin' }] } as never, ...como(ana) })
    expect(u.rol).toBe('cliente')
    expect((u.empresas ?? []).map((m) => (typeof m.empresa === 'object' ? m.empresa.id : m.empresa))).toEqual([ids.e1])
  })

  it('al dar de baja una empresa sus usuarios dejan de verla', async () => {
    await payload.update({ collection: 'empresas', id: ids.e2, data: { activa: false }, overrideAccess: true, context: ctx })
    const b = await payload.find({ collection: 'documentos', ...como(bea) })
    expect(b.totalDocs).toBe(0)
    await payload.update({ collection: 'empresas', id: ids.e2, data: { activa: true }, overrideAccess: true, context: ctx })
  })
})

describe('registro de actividad inalterable', () => {
  it('nadie puede editarlo ni borrarlo, tampoco CMC', async () => {
    process.env.CMC_2FA_SUPERADMIN = 'opcional'
    const r = await payload.find({ collection: 'actividad', limit: 1, ...como(cmc) })
    expect(r.totalDocs).toBeGreaterThan(0)
    const id = r.docs[0].id
    await expect(payload.update({ collection: 'actividad', id, data: { descripcion: 'x' }, ...como(cmc) })).rejects.toThrow()
    await expect(payload.delete({ collection: 'actividad', id, ...como(cmc) })).rejects.toThrow()
  })
})

describe('super administrador y doble factor', () => {
  it('sin doble factor activo, el super administrador no tiene privilegios', async () => {
    delete process.env.CMC_2FA_SUPERADMIN
    const sin = await payload.find({ collection: 'documentos', ...como(cmc) }).catch(() => ({ totalDocs: 0 }))
    expect(sin.totalDocs).toBe(0)
    const con = await payload.find({ collection: 'documentos', ...como({ ...cmc, totpActivo: true }) })
    expect(con.totalDocs).toBe(2)
  })

  it('el inicio de sesión exige un código válido y no reutilizado', () => {
    const s = nuevoSecreto()
    const paso = Math.floor(Date.now() / 30_000)
    const u = { id: 1, email: 'x', totpActivo: true, totpSecreto: cifrar(s) }
    expect(() => comprobarCodigoLogin(u, undefined)).toThrow()
    expect(() => comprobarCodigoLogin(u, '123')).toThrow()
    expect(comprobarCodigoLogin(u, codigo(s, paso))).toBe(paso)
    expect(() => comprobarCodigoLogin({ ...u, totpUltimoPaso: paso }, codigo(s, paso))).toThrow()
  })
})

describe('usuarios de empresa (RF-03)', () => {
  it('no se puede quitar el último administrador de una empresa', async () => {
    await expect(payload.update({ collection: 'users', id: ana.id, data: { empresas: [{ empresa: ids.e1, rol: 'usuario' }] }, overrideAccess: true, context: ctx })).rejects.toThrow(/administrador/)
  })
})
