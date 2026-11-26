/**
 * Plazo hasta la caducidad dicho como lo diría una persona: días si queda poco, meses o años si queda mucho.
 * `tono` marca la urgencia: caducado, pronto (30 días o menos), normal o sin fecha.
 */
export type Tono = 'caducado' | 'pronto' | 'normal' | 'sin'

const unidades = (dias: number) => {
  const n = Math.abs(dias)
  if (n >= 365) {
    const anios = Math.round(n / 365)
    return anios === 1 ? '1 año' : `${anios} años`
  }
  if (n >= 60) return `${Math.round(n / 30)} meses`
  return n === 1 ? '1 día' : `${n} días`
}

export function plazo(dias: number | null): { texto: string; tono: Tono } {
  if (dias === null) return { texto: 'Sin caducidad', tono: 'sin' }
  if (dias < 0) return { texto: `Caducó hace ${unidades(dias)}`, tono: 'caducado' }
  if (dias === 0) return { texto: 'Caduca hoy', tono: 'pronto' }
  if (dias === 1) return { texto: 'Caduca mañana', tono: 'pronto' }
  return { texto: `Caduca en ${unidades(dias)}`, tono: dias <= 30 ? 'pronto' : 'normal' }
}
