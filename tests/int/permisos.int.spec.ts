import { describe, expect, it } from 'vitest'
import { crearHashPassword, verificarPassword } from '@/lib/clave'
import { esSuperAdmin } from '@/access'

describe('acceso sin Payload', () => {
  it('reconoce una contraseña con el hash nuevo', async () => {
    const { hash, salt } = await crearHashPassword('CambiarEsto2026')
    expect(await verificarPassword('CambiarEsto2026', hash, salt)).toBe(true)
    expect(await verificarPassword('otra', hash, salt)).toBe(false)
  })

  it('distingue al superadmin', () => {
    expect(esSuperAdmin({ rol: 'superadmin', totpActivo: true })).toBe(true)
    expect(esSuperAdmin({ rol: 'cliente' })).toBe(false)
  })
})
