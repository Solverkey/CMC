/**
 * Esqueleto que se ve al momento al cambiar de página en el portal, mientras llega el contenido.
 * El menú lateral (layout) sigue a la vista y usable.
 */
export default function Cargando() {
  return (
    <div className="esqueleto" role="status" aria-live="polite" aria-label="Cargando">
      <span className="sr-only">Cargando…</span>
      <div className="esqueleto__linea" style={{ width: 140, height: 14 }} />
      <div className="esqueleto__linea" style={{ width: 'min(420px, 70%)', height: 40 }} />
      <div className="esqueleto__fila">
        {Array.from({ length: 5 }, (_, i) => <div key={i} className="esqueleto__bloque" style={{ height: 96 }} />)}
      </div>
      <div className="esqueleto__bloque" style={{ height: 56 }} />
      <div className="esqueleto__bloque" style={{ height: 320 }} />
    </div>
  )
}
