export type Hito =
  | { tipo: 'proxima'; clave: string }
  | { tipo: 'recordatorio'; clave: string; dias: number }
  | { tipo: 'caducado'; clave: string }
  | { tipo: 'recordatorio_caducado'; clave: string; n: number }

type Secuencia = { recordatorioDiasAntes: number; frecuenciaCaducado: 'semanal' | 'mensual'; maxRecordatoriosCaducado: number }

const DIA = 86_400_000
const dia = (v: string | Date) => {
  const d = new Date(v)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Aviso que corresponde hoy a un documento (informe, apartado 6):
 * aviso inicial en la fecha de aviso, recordatorio N días antes de caducar, aviso el día de la caducidad y
 * recordatorio semanal o mensual mientras siga caducado, hasta un máximo. La clave incluye la fecha de
 * caducidad: al publicar una renovación la secuencia anterior se detiene y empieza la nueva.
 */
export function hitoDeHoy(
  doc: { estado?: string | null; fechaCaducidad?: string | null; fechaAviso?: string | null },
  cfg: Secuencia,
  hoy: Date = new Date(),
): Hito | null {
  if (!doc.fechaCaducidad || doc.estado === 'negro' || doc.estado === 'azul') return null
  const h = dia(hoy)
  const cad = dia(doc.fechaCaducidad)
  const aviso = doc.fechaAviso ? dia(doc.fechaAviso) : cad
  const c = cad.toISOString().slice(0, 10)

  if (h >= cad) {
    const periodo = cfg.frecuenciaCaducado === 'mensual' ? 30 : 7
    const n = Math.floor((h.getTime() - cad.getTime()) / DIA / periodo)
    if (n === 0) return { tipo: 'caducado', clave: `caducado|${c}` }
    return n <= cfg.maxRecordatoriosCaducado ? { tipo: 'recordatorio_caducado', clave: `caducado-${n}|${c}`, n } : null
  }
  if (h < aviso) return null
  const dias = Math.round((cad.getTime() - h.getTime()) / DIA)
  const inicioRecordatorio = new Date(cad.getTime() - cfg.recordatorioDiasAntes * DIA)
  if (cfg.recordatorioDiasAntes > 0 && h >= inicioRecordatorio && aviso < inicioRecordatorio) return { tipo: 'recordatorio', clave: `recordatorio|${c}`, dias }
  return { tipo: 'proxima', clave: `proxima|${c}` }
}
