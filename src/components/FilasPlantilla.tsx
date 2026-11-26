'use client'

import { useState } from 'react'

export type FilaCategoria = {
  nombre: string
  antelacionMeses: string
  gestion: string
  descripcion: string
}

const vacia = (): FilaCategoria => ({ nombre: '', antelacionMeses: '', gestion: '', descripcion: '' })

/** Categorías que se crean al dar de alta una empresa. */
export function FilasPlantilla({ inicial }: { inicial: FilaCategoria[] }) {
  const [filas, setFilas] = useState<FilaCategoria[]>(inicial.length ? inicial : [vacia()])
  const cambiar = (i: number, campo: keyof FilaCategoria, valor: string) => {
    setFilas((prev) => prev.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)))
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {filas.map((fila, i) => (
        <div key={i} className="config-fila stack" style={{ gap: 12 }}>
          <div className="row" style={{ alignItems: 'end', gap: 12 }}>
            <div className="field" style={{ flex: '2 1 200px' }}>
              <label htmlFor={`cat-nombre-${i}`}>Nombre</label>
              <input id={`cat-nombre-${i}`} name="catNombre" value={fila.nombre} required onChange={(e) => cambiar(i, 'nombre', e.target.value)} />
            </div>
            <div className="field" style={{ flex: '1 1 120px' }}>
              <label htmlFor={`cat-meses-${i}`}>Antelación (meses)</label>
              <input id={`cat-meses-${i}`} name="catMeses" type="number" min={0} max={120} value={fila.antelacionMeses} placeholder="La de la plataforma" onChange={(e) => cambiar(i, 'antelacionMeses', e.target.value)} />
            </div>
            <div className="field" style={{ flex: '1 1 180px' }}>
              <label htmlFor={`cat-gestion-${i}`}>Modalidad</label>
              <select id={`cat-gestion-${i}`} name="catGestion" value={fila.gestion} onChange={(e) => cambiar(i, 'gestion', e.target.value)}>
                <option value="">Heredar</option>
                <option value="gestionado">Gestionado por CMC</option>
                <option value="no_gestionado">No gestionado</option>
              </select>
            </div>
            {filas.length > 1 && (
              <button className="btn btn--secondary btn--sm" type="button" onClick={() => setFilas((prev) => prev.filter((_, j) => j !== i))}>
                Quitar
              </button>
            )}
          </div>
          <div className="field">
            <label htmlFor={`cat-desc-${i}`}>Descripción</label>
            <textarea id={`cat-desc-${i}`} name="catDescripcion" rows={2} value={fila.descripcion} onChange={(e) => cambiar(i, 'descripcion', e.target.value)} />
          </div>
        </div>
      ))}
      <button className="btn btn--secondary" type="button" onClick={() => setFilas((prev) => [...prev, vacia()])}>
        Añadir instalación
      </button>
    </div>
  )
}
