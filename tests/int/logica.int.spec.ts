import { describe, expect, it } from 'vitest'
import { hitoDeHoy } from '@/lib/avisos'
import { crearTokenFirmado, cifrar, descifrar, leerTokenFirmado } from '@/lib/cifrado'
import { calcularEstado, peorEstado, resolverGestion } from '@/lib/estado'
import { codigo, nuevoSecreto, verificar } from '@/lib/totp'
import { normalizar, parecidos } from '@/lib/texto'

const hoy = new Date('2026-06-15T10:00:00')
const enDias = (n: number) => new Date(hoy.getTime() + n * 86_400_000).toISOString()

describe('semáforo (apartado 4)', () => {
  it('calcula verde, amarillo y rojo por fechas', () => {
    expect(calcularEstado({ fechaCaducidad: enDias(200), fechaAviso: enDias(140) }, hoy)).toBe('verde')
    expect(calcularEstado({ fechaCaducidad: enDias(30), fechaAviso: enDias(-30) }, hoy)).toBe('amarillo')
    expect(calcularEstado({ fechaCaducidad: enDias(-1), fechaAviso: enDias(-60) }, hoy)).toBe('rojo')
  })
  it('un documento indefinido sigue vigente', () => expect(calcularEstado({}, hoy)).toBe('verde'))
  it('los estados manuales mandan según la prioridad', () => {
    expect(calcularEstado({ fechaCaducidad: enDias(200), estadoManual: 'negro' }, hoy)).toBe('negro')
    expect(calcularEstado({ fechaCaducidad: enDias(200), estadoManual: 'azul' }, hoy)).toBe('azul')
    expect(calcularEstado({ fechaCaducidad: enDias(200), estadoManual: 'rojo' }, hoy)).toBe('rojo')
    expect(calcularEstado({ fechaCaducidad: enDias(200), estadoManual: 'naranja' }, hoy)).toBe('naranja')
    expect(calcularEstado({ fechaCaducidad: enDias(-5), estadoManual: 'naranja' }, hoy)).toBe('rojo')
  })
  it('el color agregado es el peor sin contar los archivados', () => {
    expect(peorEstado(['verde', 'naranja', 'amarillo'])).toBe('amarillo')
    expect(peorEstado(['verde', 'azul'])).toBe('verde')
    expect(peorEstado(['verde', 'negro'])).toBe('negro')
    expect(peorEstado([])).toBe('verde')
  })
})

describe('Gestionado / No gestionado', () => {
  it('manda el nivel más concreto y por defecto no gestionado', () => {
    expect(resolverGestion('gestionado', null, null)).toBe('gestionado')
    expect(resolverGestion('gestionado', 'no_gestionado', null)).toBe('no_gestionado')
    expect(resolverGestion(null, null, 'gestionado')).toBe('gestionado')
    expect(resolverGestion(null, undefined, null)).toBe('no_gestionado')
  })
})

describe('secuencia de avisos (apartado 6)', () => {
  const cfg = { recordatorioDiasAntes: 15, frecuenciaCaducado: 'semanal' as const, maxRecordatoriosCaducado: 3 }
  it('aviso inicial, recordatorio, caducado y recordatorios hasta el máximo', () => {
    const doc = { fechaCaducidad: enDias(60), fechaAviso: enDias(0) }
    expect(hitoDeHoy(doc, cfg, hoy)?.tipo).toBe('proxima')
    expect(hitoDeHoy(doc, cfg, new Date(enDias(-1)))).toBeNull()
    expect(hitoDeHoy(doc, cfg, new Date(enDias(46)))?.tipo).toBe('recordatorio')
    expect(hitoDeHoy(doc, cfg, new Date(enDias(60)))?.tipo).toBe('caducado')
    expect(hitoDeHoy(doc, cfg, new Date(enDias(67)))).toMatchObject({ tipo: 'recordatorio_caducado', n: 1 })
    expect(hitoDeHoy(doc, cfg, new Date(enDias(60 + 7 * 4)))).toBeNull()
  })
  it('al renovar cambia la clave y la secuencia empieza de nuevo', () => {
    const a = hitoDeHoy({ fechaCaducidad: enDias(-1), fechaAviso: enDias(-60) }, cfg, hoy)
    const b = hitoDeHoy({ fechaCaducidad: enDias(365), fechaAviso: enDias(0) }, cfg, hoy)
    expect(a?.clave).not.toBe(b?.clave)
  })
  it('no avisa de archivados ni de no legalizados', () => {
    expect(hitoDeHoy({ fechaCaducidad: enDias(-1), estado: 'negro' }, cfg, hoy)).toBeNull()
    expect(hitoDeHoy({ fechaCaducidad: enDias(-1), estado: 'azul' }, cfg, hoy)).toBeNull()
  })
})

describe('doble factor (TOTP)', () => {
  it('acepta el código actual una sola vez y rechaza los demás', () => {
    const s = nuevoSecreto()
    const ahora = Date.now()
    const paso = Math.floor(ahora / 30_000)
    const usado = verificar(s, codigo(s, paso), null, ahora)
    expect(usado).toBe(paso)
    expect(verificar(s, codigo(s, paso), usado, ahora)).toBeNull()
    expect(verificar(s, codigo(s, paso + 5), null, ahora)).toBeNull()
    expect(verificar(s, '000000x', null, ahora)).toBeNull()
  })
  it('el secreto se guarda cifrado', () => {
    const c = cifrar('SECRETO')
    expect(c).not.toContain('SECRETO')
    expect(descifrar(c)).toBe('SECRETO')
  })
})

describe('enlaces firmados', () => {
  it('caducan y no sirven para otro uso', () => {
    const t = crearTokenFirmado({ a: 1 }, 60, 'descarga')
    expect(leerTokenFirmado<{ a: number }>(t, 'descarga')?.a).toBe(1)
    expect(leerTokenFirmado(t, 'invitacion')).toBeNull()
    expect(leerTokenFirmado(`${t}x`, 'descarga')).toBeNull()
    expect(leerTokenFirmado(crearTokenFirmado({ a: 1 }, -1, 'descarga'), 'descarga')).toBeNull()
  })
})

describe('catálogos (RF-28)', () => {
  it('compara sin mayúsculas ni acentos y detecta nombres parecidos', () => {
    expect(normalizar('  Inspección  OCA ')).toBe(normalizar('inspeccion oca'))
    expect(parecidos('Certificado ISO 9001', 'Certificado ISO 9001 ')).toBe(true)
    expect(parecidos('Inspeccion OCA', 'Inspecion OCA')).toBe(true)
    expect(parecidos('Licencia ambiental', 'Plan de autoprotección')).toBe(false)
  })
})
