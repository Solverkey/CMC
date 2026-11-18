import type { Payload, PayloadRequest } from 'payload'
import { PLANTILLAS, type ClavePlantilla, type Plantilla } from './plantillas'

export type Config = {
  antelacionMeses: number
  recordatorioDiasAntes: number
  frecuenciaCaducado: 'semanal' | 'mensual'
  maxRecordatoriosCaducado: number
  remitenteNombre: string
  remitenteEmail: string
  responderA?: string
  logoUrl?: string
  colorPrimario: string
  firma: string
  ladoMaximo: number
  calidad: number
  conservarOriginal: boolean
  limiteGB: number
  avisoPorcentaje: number
  plantillaCategorias: { nombre: string; antelacionMeses?: number | null; gestion?: string | null; descripcion?: string | null }[]
  plantilla: (clave: ClavePlantilla) => Plantilla
}

const num = (v: unknown, d: number) => (typeof v === 'number' && !Number.isNaN(v) ? v : d)

/** Configuración de la plataforma con los valores por defecto del informe para lo que no se haya guardado. */
export async function leerConfiguracion(payload: Payload, req?: PayloadRequest): Promise<Config> {
  const g = (await payload.findGlobal({ slug: 'configuracion', depth: 1, overrideAccess: true, ...(req ? { req } : {}) }).catch(() => ({}))) as Record<string, any>
  const plantillas = (g.plantillas ?? {}) as Record<string, Partial<Plantilla>>
  return {
    antelacionMeses: num(g.antelacionMeses, 2),
    recordatorioDiasAntes: num(g.recordatorioDiasAntes, 15),
    frecuenciaCaducado: g.frecuenciaCaducado === 'mensual' ? 'mensual' : 'semanal',
    maxRecordatoriosCaducado: num(g.maxRecordatoriosCaducado, 6),
    remitenteNombre: g.remitenteNombre || process.env.EMAIL_FROM_NAME || 'CMC · Portal documental',
    remitenteEmail: g.remitenteEmail || process.env.EMAIL_FROM || 'avisos@localhost',
    responderA: g.responderA || process.env.EMAIL_REPLY_TO || undefined,
    logoUrl: typeof g.logo === 'object' && g.logo?.url ? g.logo.url : undefined,
    colorPrimario: /^#[0-9a-f]{3,8}$/i.test(g.colorPrimario ?? '') ? g.colorPrimario : '#4d6162',
    firma: g.firma ?? 'CMC · Consultoría de calidad y medio ambiente',
    ladoMaximo: num(g.ladoMaximo, 2500),
    calidad: num(g.calidad, 82),
    conservarOriginal: Boolean(g.conservarOriginal),
    limiteGB: num(g.limiteGB, 10),
    avisoPorcentaje: num(g.avisoPorcentaje, 80),
    plantillaCategorias: Array.isArray(g.plantillaCategorias) && g.plantillaCategorias.length ? g.plantillaCategorias : [{ nombre: 'Alta tensión' }, { nombre: 'Baja tensión' }],
    plantilla: (clave) => {
      const base = PLANTILLAS[clave]
      const p = plantillas[clave] ?? {}
      return { etiqueta: base.etiqueta, asunto: p.asunto || base.asunto, cuerpo: p.cuerpo || base.cuerpo, boton: p.boton || base.boton }
    },
  }
}

export const urlServidor = () => (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')
