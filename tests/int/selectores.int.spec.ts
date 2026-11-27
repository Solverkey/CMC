// @vitest-environment node
import { rmSync } from 'fs'
import { beforeAll, describe, expect, it } from 'vitest'

// Base SQLite propia de esta prueba, creada con el esquema completo.
process.env.DATABASE_URL = 'file:./tests/.cmc-selectores.db'
process.env.CMC_2FA_SUPERADMIN = 'opcional'
rmSync('./tests/.cmc-selectores.db', { force: true })

const { crearEsquema } = await import('@/lib/esquema')
const { ejecutar, uno, ahora } = await import('@/lib/db')
const S = await import('@/servicios/selectores')
const { usuarioPorId } = await import('@/datos/usuarios')

const ctxDe = async (id: number) => ({ user: await usuarioPorId(id), headers: new Headers(), origen: 'web' as const, context: {} })

beforeAll(async () => {
  await crearEsquema()
  const m = ahora()
  await ejecutar(`INSERT INTO users (id, email, nombre, rol, activo, recibe_avisos, totp_activo, hash, salt, updated_at, created_at) VALUES (1, 'cmc@cmc.test', 'CMC', 'superadmin', 1, 1, 1, 'x', 'y', $1, $1)`, [m])
  await ejecutar(`INSERT INTO users (id, email, nombre, rol, activo, recibe_avisos, totp_activo, hash, salt, updated_at, created_at) VALUES (2, 'cli@x.test', 'Cliente', 'cliente', 1, 1, 0, 'x', 'y', $1, $1)`, [m])
  await ejecutar(`INSERT INTO empresas (id, razon_social, cif, activa, updated_at, created_at) VALUES (1, 'Demo', 'B1', 1, $1, $1)`, [m])
})

describe('instalaciones desde el formulario', () => {
  it('crea, evita duplicados (sin acentos ni mayúsculas) y solo deja a CMC', async () => {
    const cmc = await ctxDe(1)
    const a = await S.crearInstalacion(cmc, 1, '  Baja   tensión ')
    expect(a.texto).toBe('Baja tensión')
    await expect(S.crearInstalacion(cmc, 1, 'baja tension')).rejects.toThrow(/ya tiene/)
    await expect(S.crearInstalacion(await ctxDe(2), 1, 'Otra')).rejects.toThrow(/Solo CMC/)
  })

  it('renombra; el nombre viejo sin uso desaparece del catálogo', async () => {
    const cmc = await ctxDe(1)
    const c = await S.crearInstalacion(cmc, 1, 'Fotovoltaca')
    await S.renombrarInstalacion(cmc, c.valor, 'Fotovoltaica')
    const nombres = (await S.opcionesCatalogo(cmc, 'categoria')).map((o) => o.texto)
    expect(nombres).toContain('Fotovoltaica')
    expect(nombres).not.toContain('Fotovoltaca')
    await expect(S.renombrarInstalacion(cmc, c.valor, 'BAJA TENSIÓN')).rejects.toThrow(/Ya hay/)
  })

  it('quitar borra si no tiene documentos y archiva si los tiene; crearla otra vez la recupera', async () => {
    const cmc = await ctxDe(1)
    const vacia = await S.crearInstalacion(cmc, 1, 'Provisional')
    expect((await S.quitarInstalacion(cmc, vacia.valor)).borrada).toBe(true)
    expect(await uno('SELECT id FROM categorias WHERE id = $1', [Number(vacia.valor)])).toBeFalsy()

    const llena = await S.crearInstalacion(cmc, 1, 'Alta tensión')
    await ejecutar(`INSERT INTO documentos (titulo, empresa_id, categoria_id, updated_at, created_at) VALUES ('Acta', 1, $1, $2, $2)`, [Number(llena.valor), ahora()])
    const r = await S.quitarInstalacion(cmc, llena.valor)
    expect(r.borrada).toBe(false)
    expect(r.mensaje).toMatch(/1 documento/)
    const otra = await S.crearInstalacion(cmc, 1, 'alta tension')
    expect(otra.valor).toBe(llena.valor)
  })
})

describe('catálogos desde el formulario', () => {
  it('crea un tipo de relación con efectos, lo renombra en todo lo que lo usa y lo quita', async () => {
    const cmc = await ctxDe(1)
    await expect(S.crearEnCatalogo(cmc, 'relacion', 'Certificado final', [])).rejects.toThrow(/efecto/)
    const t = await S.crearEnCatalogo(cmc, 'relacion', 'Certificado final', ['sustituye'])
    expect(t.nota).toBe('Sustituye al vigente')
    await ejecutar(`INSERT INTO archivos (documento_id, relacion, updated_at, created_at) VALUES (1, 'Certificado final', $1, $1)`, [ahora()])
    expect(await S.usosDeNombre(cmc, 'relacion', 'Certificado final')).toBe(1)
    await S.renombrarEnCatalogo(cmc, 'relacion', 'Certificado final', 'Certificado final de obra')
    expect(await uno<{ relacion: string }>('SELECT relacion FROM archivos LIMIT 1')).toEqual({ relacion: 'Certificado final de obra' })
    await S.quitarDeCatalogo(cmc, 'relacion', 'Certificado final de obra')
    expect((await S.opcionesCatalogo(cmc, 'relacion')).map((o) => o.texto)).not.toContain('Certificado final de obra')
  })
})
