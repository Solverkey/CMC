import crypto from 'crypto'
import { PLANTILLAS, type ClavePlantilla, type Plantilla } from './plantillas'
import { ahora, bit, ejecutar, filas, num, uno } from './db'
import { urlPublica } from './ficheros'

export type Config = {
  antelacionMeses: number
  recordatorioDiasAntes: number
  frecuenciaCaducado: 'semanal' | 'mensual'
  maxRecordatoriosCaducado: number
  remitenteNombre: string
  remitenteEmail: string
  responderA?: string
  logoUrl?: string
  logoId?: number | null
  colorPrimario: string
  firma: string
  ladoMaximo: number
  calidad: number
  conservarOriginal: boolean
  limiteGB: number
  avisoPorcentaje: number
  plantillaCategorias: { nombre: string; antelacionMeses?: number | null; gestion?: string | null; descripcion?: string | null }[]
  plantilla: (clave: ClavePlantilla) => Plantilla
  cruda: Record<string, unknown>
}

const n = (v: unknown, d: number) => (typeof v === 'number' && !Number.isNaN(v) ? v : typeof v === 'string' && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d)

/** Configuración de la plataforma con los valores por defecto del informe para lo que no se haya guardado. */
export async function leerConfiguracion(): Promise<Config> {
  const g = ((await uno<Record<string, unknown>>('SELECT * FROM configuracion ORDER BY id LIMIT 1').catch(() => null)) ?? {}) as Record<string, unknown>
  const cats = g.id
    ? await filas<Record<string, unknown>>('SELECT * FROM configuracion_plantilla_categorias WHERE _parent_id = $1 ORDER BY _order', [g.id])
    : []
  let logoUrl: string | undefined
  if (g.logo_id) {
    const logo = await uno<{ filename: string | null; url: string | null }>('SELECT filename, url FROM media WHERE id = $1', [g.logo_id])
    logoUrl = logo?.filename ? await urlPublica('media', logo.filename) : logo?.url || undefined
  }
  const plantillas = Object.fromEntries(
    (Object.keys(PLANTILLAS) as ClavePlantilla[]).map((clave) => [
      clave,
      {
        asunto: g[`plantillas_${clave}_asunto`],
        cuerpo: g[`plantillas_${clave}_cuerpo`],
        boton: g[`plantillas_${clave}_boton`],
      },
    ]),
  ) as Record<string, Partial<Plantilla>>
  return {
    antelacionMeses: n(g.antelacion_meses, 2),
    recordatorioDiasAntes: n(g.recordatorio_dias_antes, 15),
    frecuenciaCaducado: g.frecuencia_caducado === 'mensual' ? 'mensual' : 'semanal',
    maxRecordatoriosCaducado: n(g.max_recordatorios_caducado, 6),
    remitenteNombre: String(g.remitente_nombre || process.env.EMAIL_FROM_NAME || 'CMC · Portal documental'),
    remitenteEmail: String(g.remitente_email || process.env.EMAIL_FROM || 'avisos@localhost'),
    responderA: (g.responder_a as string) || process.env.EMAIL_REPLY_TO || undefined,
    logoUrl,
    logoId: g.logo_id == null ? null : Number(g.logo_id),
    colorPrimario: /^#[0-9a-f]{3,8}$/i.test(String(g.color_primario ?? '')) ? String(g.color_primario) : '#4d6162',
    firma: String(g.firma ?? 'CMC · Consultoría de calidad y medio ambiente'),
    ladoMaximo: n(g.lado_maximo, 2500),
    calidad: n(g.calidad, 82),
    conservarOriginal: Boolean(g.conservar_original),
    limiteGB: 10,
    avisoPorcentaje: 80,
    plantillaCategorias: cats.length
      ? cats.map((c) => ({ nombre: String(c.nombre), antelacionMeses: num(c.antelacion_meses), gestion: (c.gestion as string) || null, descripcion: (c.descripcion as string) || null }))
      : [{ nombre: 'Alta tensión' }, { nombre: 'Baja tensión' }],
    plantilla: (clave) => {
      const base = PLANTILLAS[clave]
      const p = plantillas[clave] ?? {}
      return { etiqueta: base.etiqueta, asunto: (p.asunto as string) || base.asunto, cuerpo: (p.cuerpo as string) || base.cuerpo, boton: (p.boton as string) || base.boton }
    },
    cruda: g,
  }
}

export type GuardarConfig = {
  antelacionMeses: number
  recordatorioDiasAntes: number
  frecuenciaCaducado: 'semanal' | 'mensual'
  maxRecordatoriosCaducado: number
  remitenteNombre: string
  remitenteEmail: string | null
  responderA: string | null
  logo: number | null
  colorPrimario: string
  firma: string
  ladoMaximo: number
  calidad: number
  conservarOriginal: boolean
  plantillas: Record<string, { asunto?: string | null; cuerpo?: string | null; boton?: string | null }>
  plantillaCategorias: { nombre: string; antelacionMeses?: number | null; gestion?: string | null; descripcion?: string | null }[]
}

export async function guardarConfiguracion(datos: GuardarConfig) {
  const actual = await uno<{ id: number }>('SELECT id FROM configuracion ORDER BY id LIMIT 1')
  const momento = ahora()
  const columnas = [
    'antelacion_meses',
    'recordatorio_dias_antes',
    'frecuencia_caducado',
    'max_recordatorios_caducado',
    'remitente_nombre',
    'remitente_email',
    'responder_a',
    'logo_id',
    'color_primario',
    'firma',
    'lado_maximo',
    'calidad',
    'conservar_original',
    'updated_at',
  ]
  const valores: unknown[] = [
    datos.antelacionMeses,
    datos.recordatorioDiasAntes,
    datos.frecuenciaCaducado,
    datos.maxRecordatoriosCaducado,
    datos.remitenteNombre,
    datos.remitenteEmail,
    datos.responderA,
    datos.logo,
    datos.colorPrimario,
    datos.firma,
    datos.ladoMaximo,
    datos.calidad,
    bit(datos.conservarOriginal),
    momento,
  ]
  for (const [clave, p] of Object.entries(datos.plantillas)) {
    columnas.push(`plantillas_${clave}_asunto`, `plantillas_${clave}_cuerpo`, `plantillas_${clave}_boton`)
    valores.push(p.asunto ?? null, p.cuerpo ?? null, p.boton ?? null)
  }
  let id = actual?.id
  if (!id) {
    const cols = [...columnas, 'created_at']
    const ph = cols.map((_, i) => `$${i + 1}`).join(', ')
    const row = await uno<{ id: number }>(`INSERT INTO configuracion (${cols.join(', ')}) VALUES (${ph}) RETURNING id`, [...valores, momento])
    id = row!.id
  } else {
    const set = columnas.map((c, i) => `${c} = $${i + 2}`).join(', ')
    await ejecutar(`UPDATE configuracion SET ${set} WHERE id = $1`, [id, ...valores])
    await ejecutar('DELETE FROM configuracion_plantilla_categorias WHERE _parent_id = $1', [id])
  }
  let orden = 1
  for (const c of datos.plantillaCategorias) {
    await ejecutar(
      'INSERT INTO configuracion_plantilla_categorias (id, _order, _parent_id, nombre, antelacion_meses, gestion, descripcion) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [crypto.randomUUID(), orden++, id, c.nombre, c.antelacionMeses ?? null, c.gestion || null, c.descripcion ?? null],
    )
  }
}

export { urlServidor } from './url'
