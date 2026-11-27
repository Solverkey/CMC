// @vitest-environment node
import { rmSync } from 'fs'
import { beforeAll, describe, expect, it } from 'vitest'

// Base SQLite propia de esta prueba, creada con el esquema completo.
process.env.DATABASE_URL = 'file:./tests/.cmc-servidor.db'
process.env.CMC_2FA_SUPERADMIN = 'opcional'
rmSync('./tests/.cmc-servidor.db', { force: true })

const { crearEsquema } = await import('@/lib/esquema')
const { ejecutar, uno, filas, ahora } = await import('@/lib/db')
const { vaciarCola, MOTIVO_SIN_SMTP } = await import('@/lib/correo')
const { invitarCmc, cambiarEquipoCmc, equipoCmc } = await import('@/servicios/usuarios')
const { usuarioPorId } = await import('@/datos/usuarios')

const ctxDe = async (id: number) => ({ user: await usuarioPorId(id), headers: new Headers(), origen: 'web' as const, context: {} })

beforeAll(async () => {
  await crearEsquema()
  const m = ahora()
  await ejecutar(`INSERT INTO users (id, email, nombre, rol, activo, recibe_avisos, totp_activo, hash, salt, updated_at, created_at) VALUES (1, 'jefa@cmc.test', 'Jefa', 'superadmin', 1, 1, 1, 'x', 'y', $1, $1)`, [m])
})

describe('correo sin servidor configurado', () => {
  it('en Vercel sin SMTP no se marca como enviado, y la cola no se atasca con lo descartado', async () => {
    const m = ahora()
    for (const id of [1, 2]) {
      await ejecutar(`INSERT INTO correos (id, asunto, para, estado, updated_at, created_at) VALUES ($1, 'Aviso', 'a@b.c', 'pendiente', $2, $2)`, [id, m])
    }
    await ejecutar(`INSERT INTO payload_kv (key, data) VALUES ('correo:1', $1)`, [JSON.stringify({ html: '<p>Hola</p>', desde: 'CMC <a@cmc.es>' })])
    // El 2 no tiene contenido guardado: antes se quedaba en la cola para siempre.
    const antes = { VERCEL: process.env.VERCEL, SMTP_HOST: process.env.SMTP_HOST }
    process.env.VERCEL = '1'
    delete process.env.SMTP_HOST
    try {
      const r = await vaciarCola(50)
      expect(r.revisados).toBe(1)
      const c = await uno<{ estado: string; error: string }>('SELECT estado, error FROM correos WHERE id = 1')
      expect(c).toEqual({ estado: 'error', error: MOTIVO_SIN_SMTP })
      expect(await filas('SELECT key FROM payload_kv')).toHaveLength(0)
      expect((await vaciarCola(50)).revisados).toBe(0)
    } finally {
      Object.assign(process.env, antes)
      if (!antes.VERCEL) delete process.env.VERCEL
    }
  })
})

describe('equipo de CMC', () => {
  it('invita, cambia los avisos y protege al último activo y a uno mismo', async () => {
    const jefa = await ctxDe(1)
    const nuevo = await invitarCmc(jefa, { email: 'Tecnico@CMC.test', nombre: 'Técnico' })
    expect(nuevo.rol).toBe('superadmin')
    expect(nuevo.email).toBe('tecnico@cmc.test')
    await expect(invitarCmc(jefa, { email: 'tecnico@cmc.test' })).rejects.toThrow(/Ya existe/)

    await cambiarEquipoCmc(jefa, nuevo.id, { recibeAvisos: false })
    const equipo = await equipoCmc(jefa)
    expect(equipo.find((p) => p.id === nuevo.id)).toMatchObject({ recibeAvisos: false, pendiente: true, activo: true })

    await expect(cambiarEquipoCmc(jefa, 1, { activo: false })).rejects.toThrow(/propia cuenta/)
    await cambiarEquipoCmc(jefa, nuevo.id, { activo: false })
    expect((await usuarioPorId(nuevo.id))?.activo).toBe(false)
    // La jefa es ahora la única activa: nadie puede desactivarla (tampoco el otro, que ya no tiene permisos).
    await cambiarEquipoCmc(jefa, nuevo.id, { activo: true })
    const tecnico = await ctxDe(nuevo.id)
    await cambiarEquipoCmc(jefa, nuevo.id, { activo: false })
    await expect(cambiarEquipoCmc({ ...tecnico, user: { ...tecnico.user!, activo: true } }, 1, { activo: false })).rejects.toThrow(/al menos una persona/)
  })

  it('un cliente no puede gestionar el equipo', async () => {
    const m = ahora()
    await ejecutar(`INSERT INTO users (id, email, nombre, rol, activo, hash, salt, updated_at, created_at) VALUES (50, 'cli@x.test', 'Cliente', 'cliente', 1, 'x', 'y', $1, $1)`, [m])
    await expect(invitarCmc(await ctxDe(50), { email: 'otro@cmc.test' })).rejects.toThrow(/Solo CMC/)
  })
})
