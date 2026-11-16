/** Minúsculas, sin acentos y con espacios simples: base de búsquedas y deduplicación de catálogos. */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export function distancia(a: string, b: string) {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** «Inspeccion OCA» y «Inspección OCA» son parecidos; también lo son los que difieren en una o dos letras. */
export function parecidos(a: string, b: string) {
  const x = normalizar(a)
  const y = normalizar(b)
  if (!x || !y) return false
  if (x === y) return true
  const tolerancia = Math.min(2, Math.floor(Math.min(x.length, y.length) / 6))
  return tolerancia > 0 && distancia(x, y) <= tolerancia
}

export const rellenar = (plantilla: string, vars: Record<string, string | number | null | undefined>) =>
  plantilla.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => (vars[k] === undefined || vars[k] === null ? '' : String(vars[k])))

export const escaparHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
