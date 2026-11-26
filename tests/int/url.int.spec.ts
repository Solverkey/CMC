// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { urlServidor } from '@/lib/url'

const original = { ...process.env }
afterEach(() => {
  process.env = { ...original }
})
const con = (vars: Record<string, string | undefined>) => {
  for (const k of ['NEXT_PUBLIC_SERVER_URL', 'VERCEL_ENV', 'VERCEL_PROJECT_PRODUCTION_URL', 'VERCEL_URL']) delete process.env[k]
  Object.assign(process.env, vars)
}

describe('dirección pública del portal', () => {
  it('manda NEXT_PUBLIC_SERVER_URL, sin barra final', () => {
    con({ NEXT_PUBLIC_SERVER_URL: 'https://portal.cmc.es/', VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'cmc.vercel.app' })
    expect(urlServidor()).toBe('https://portal.cmc.es')
  })
  it('sin ella, en producción de Vercel usa la dirección de producción del proyecto', () => {
    con({ VERCEL_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: 'cmc-gilt.vercel.app', VERCEL_URL: 'cmc-abc123.vercel.app' })
    expect(urlServidor()).toBe('https://cmc-gilt.vercel.app')
  })
  it('en una previsualización usa la de ese despliegue', () => {
    con({ VERCEL_ENV: 'preview', VERCEL_PROJECT_PRODUCTION_URL: 'cmc-gilt.vercel.app', VERCEL_URL: 'cmc-abc123.vercel.app' })
    expect(urlServidor()).toBe('https://cmc-abc123.vercel.app')
  })
  it('en local, localhost', () => {
    con({})
    expect(urlServidor()).toBe('http://localhost:3000')
  })
})
