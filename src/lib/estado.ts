export type Estado = 'verde' | 'amarillo' | 'naranja' | 'rojo' | 'azul' | 'negro'
export type EstadoManual = 'naranja' | 'rojo' | 'azul' | 'negro' | null | undefined

export const ESTADOS: Record<Estado, { label: string; prioridad: number }> = {
  azul: { label: 'Pasado o archivado', prioridad: 0 },
  verde: { label: 'Vigente', prioridad: 1 },
  naranja: { label: 'Condicionada', prioridad: 2 },
  amarillo: { label: 'Caducidad próxima', prioridad: 3 },
  rojo: { label: 'Caducada', prioridad: 4 },
  negro: { label: 'No legalizado', prioridad: 5 },
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
 * Automáticos: verde, amarillo (caducidad próxima), rojo. Manuales: naranja (condicionada), rojo, azul, negro.
 * Prioridad: No legalizado → Caducada → Caducidad próxima → Condicionada → Vigente. El azul no entra en el agregado.
 */
export function calcularEstado(
  doc: { fechaCaducidad?: string | null; fechaAviso?: string | null; estadoManual?: EstadoManual },
  hoy: Date = new Date(),
): Estado {
  const h = dia(hoy)!
  if (doc.estadoManual === 'negro') return 'negro'
  if (doc.estadoManual === 'azul') return 'azul'
  if (doc.estadoManual === 'rojo') return 'rojo'
  const cad = dia(doc.fechaCaducidad)
  const aviso = dia(doc.fechaAviso)
  if (cad && h > cad) return 'rojo'
  if (aviso && h >= aviso) return 'amarillo'
  if (doc.estadoManual === 'naranja') return 'naranja'
  return 'verde'
}

/** El color agregado de una categoría o empresa es el peor de sus documentos, sin contar los archivados. */
export function peorEstado(estados: Estado[]): Estado {
  const vivos = estados.filter((e) => e !== 'azul')
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
