export type Estado = 'verde' | 'amarillo' | 'naranja' | 'rojo' | 'negro'
export type EstadoManual = Estado | null | undefined

export const ESTADOS: Record<Estado, { label: string; prioridad: number }> = {
  negro: { label: 'No aplica', prioridad: 0 },
  verde: { label: 'Vigente', prioridad: 1 },
  amarillo: { label: 'Condicionada', prioridad: 2 },
  naranja: { label: 'Caducidad próxima', prioridad: 3 },
  rojo: { label: 'Caducada', prioridad: 4 },
}

/** Antelación de aviso por defecto de la plataforma (informe funcional, apartado 6). */
export const ANTELACION_MESES_DEFECTO = 2

export const restarMeses = (fecha: Date, meses: number) => {
  const d = new Date(fecha)
  d.setMonth(d.getMonth() - meses)
  return d
}

const dia = (v?: string | Date | null) => {
  if (!v) return null
  const d = new Date(v)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Cálculo del semáforo (informe funcional, apartado 4).
 * Automáticos: verde, naranja, rojo. Manuales: amarillo, rojo, negro.
 * Prioridad de visualización: Negro → Rojo → Naranja → Amarillo → Verde.
 */
export function calcularEstado(
  doc: { fechaCaducidad?: string | null; fechaAviso?: string | null; estadoManual?: EstadoManual },
  hoy: Date = new Date(),
): Estado {
  const h = dia(hoy)!
  if (doc.estadoManual === 'negro') return 'negro'
  if (doc.estadoManual === 'rojo') return 'rojo'
  const cad = dia(doc.fechaCaducidad)
  const aviso = dia(doc.fechaAviso)
  if (cad && h > cad) return 'rojo'
  if (aviso && h >= aviso) return 'naranja'
  if (doc.estadoManual === 'amarillo') return 'amarillo'
  return 'verde'
}

/** El color agregado de una categoría o empresa es el peor de sus documentos, sin contar los negros. */
export function peorEstado(estados: Estado[]): Estado {
  const vivos = estados.filter((e) => e !== 'negro')
  if (!vivos.length) return 'verde'
  return vivos.reduce((a, b) => (ESTADOS[b].prioridad > ESTADOS[a].prioridad ? b : a))
}

/** Herencia Gestionado / No gestionado: manda el nivel más concreto; sin indicar = no gestionado. */
export function resolverGestion(...niveles: (string | null | undefined)[]): 'gestionado' | 'no_gestionado' {
  for (let i = niveles.length - 1; i >= 0; i--) {
    const v = niveles[i]
    if (v === 'gestionado' || v === 'no_gestionado') return v
  }
  return 'no_gestionado'
}
