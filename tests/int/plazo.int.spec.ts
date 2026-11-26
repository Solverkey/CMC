import { describe, expect, it } from 'vitest'
import { plazo } from '@/lib/plazo'

describe('plazo hasta la caducidad', () => {
  it('días cuando queda poco y tono según la urgencia', () => {
    expect(plazo(8)).toEqual({ texto: 'Caduca en 8 días', tono: 'pronto' })
    expect(plazo(45)).toEqual({ texto: 'Caduca en 45 días', tono: 'normal' })
    expect(plazo(0).texto).toBe('Caduca hoy')
    expect(plazo(1).texto).toBe('Caduca mañana')
  })
  it('meses y años cuando queda mucho', () => {
    expect(plazo(300).texto).toBe('Caduca en 10 meses')
    expect(plazo(700).texto).toBe('Caduca en 2 años')
    expect(plazo(400).texto).toBe('Caduca en 1 año')
  })
  it('caducados y sin fecha', () => {
    expect(plazo(-12)).toEqual({ texto: 'Caducó hace 12 días', tono: 'caducado' })
    expect(plazo(-60).texto).toBe('Caducó hace 2 meses')
    expect(plazo(null)).toEqual({ texto: 'Sin caducidad', tono: 'sin' })
  })
})
