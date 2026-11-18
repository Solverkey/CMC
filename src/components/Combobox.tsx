'use client'
import { useEffect, useId, useState } from 'react'
import { nombreDeOpcion, opcionNueva } from '@/lib/catalogoCampo'

type Sugerencias = { opciones: { id: number | string; nombre: string }[]; exacta: string | null; similares: string[] }

/** Campo con autocompletado de los catálogos de nombres y aviso de nombres parecidos (RF-28). */
export function Combobox({ tipo, name, id, defaultValue, placeholder, categoria }: { tipo: 'categoria' | 'documento' | 'relacion'; name: string; id: string; defaultValue?: string; placeholder?: string; categoria?: string }) {
  const [valor, setValor] = useState(defaultValue ?? '')
  const [s, setS] = useState<Sugerencias>({ opciones: [], exacta: null, similares: [] })
  const lista = useId()

  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      const q = new URLSearchParams({ tipo, q: valor, ...(categoria ? { categoria } : {}) })
      fetch(`/api/catalogo/sugerencias?${q}`, { credentials: 'include', signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setS(d))
        .catch(() => null)
    }, 200)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [tipo, valor, categoria])

  return (
    <>
      <input id={id} name={name} list={lista} value={valor} placeholder={placeholder} autoComplete="off" onChange={(e) => setValor(nombreDeOpcion(e.target.value))} />
      <datalist id={lista}>
        {s.opciones.map((o) => <option key={o.id} value={o.nombre} />)}
        {valor.trim() && !s.exacta && <option value={opcionNueva(valor)} />}
      </datalist>
      {s.exacta && s.exacta !== valor && (
        <span className="hint">Se guardará como <button type="button" className="enlace" onClick={() => setValor(s.exacta!)}>«{s.exacta}»</button></span>
      )}
      {valor.trim() && !s.exacta && s.similares.length > 0 && (
        <span className="hint" role="status">
          ¿Quiso decir{' '}
          {s.similares.map((n, i) => (
            <span key={n}>{i > 0 && ', '}<button type="button" className="enlace" onClick={() => setValor(n)}>«{n}»</button></span>
          ))}
          ?
        </span>
      )}
    </>
  )
}
