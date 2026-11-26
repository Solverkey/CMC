'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

type Opcion = { id: string; nombre: string }
type Props = { empresas: Opcion[]; categorias: Opcion[] | null; ordenes: { id: string; texto: string }[] }

/** Búsqueda de documentos: se aplica al escribir o elegir, sin botón, y conserva el resto de filtros. */
export function FiltrosDocumentos({ empresas, categorias, ordenes }: Props) {
  const router = useRouter()
  const ruta = usePathname()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const [fechas, setFechas] = useState(Boolean(sp.get('desde') || sp.get('hasta')))
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(reloj.current), [])

  const ir = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString())
    p.delete('pagina')
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    const qs = p.toString()
    router.replace(`${ruta}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  return (
    <form className="buscador" role="search" onSubmit={(e) => { e.preventDefault(); ir({ q: q.trim() || null }) }}>
      <div className="buscador__texto">
        <Icon name="search" />
        <input
          type="search"
          value={q}
          aria-label="Buscar documentos"
          placeholder="Buscar por nombre, referencia u organismo"
          onChange={(e) => {
            const v = e.target.value
            setQ(v)
            clearTimeout(reloj.current)
            reloj.current = setTimeout(() => ir({ q: v.trim() || null }), 350)
          }}
        />
      </div>
      {empresas.length > 1 && (
        <select className="input" aria-label="Empresa" value={sp.get('empresa') ?? ''} onChange={(e) => ir({ empresa: e.target.value || null, categoria: null })}>
          <option value="">Todas las empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      )}
      {categorias && categorias.length > 0 && (
        <select className="input" aria-label="Instalación" value={sp.get('categoria') ?? ''} onChange={(e) => ir({ categoria: e.target.value || null })}>
          <option value="">Todas las instalaciones</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      )}
      <select className="input" aria-label="Ordenar por" value={sp.get('orden') ?? 'urgencia'} onChange={(e) => ir({ orden: e.target.value === 'urgencia' ? null : e.target.value })}>
        {ordenes.map((o) => <option key={o.id} value={o.id}>Orden: {o.texto}</option>)}
      </select>
      <button type="button" className="btn btn--ghost btn--sm" aria-expanded={fechas} onClick={() => setFechas((f) => !f)}>
        <Icon name="clock" />Fechas
      </button>
      {fechas && (
        <div className="buscador__fechas">
          <label className="small">Caduca desde <input className="input" type="date" defaultValue={sp.get('desde') ?? ''} onChange={(e) => ir({ desde: e.target.value || null })} /></label>
          <label className="small">hasta <input className="input" type="date" defaultValue={sp.get('hasta') ?? ''} onChange={(e) => ir({ hasta: e.target.value || null })} /></label>
        </div>
      )}
    </form>
  )
}
