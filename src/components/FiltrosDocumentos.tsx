'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'
import { Desplegable } from './Desplegable'
import { RangoFechas } from './RangoFechas'

type Opcion = { id: string; nombre: string }
type Props = { empresas: Opcion[]; categorias: Opcion[] | null; ordenes: { id: string; texto: string }[] }

/** Búsqueda de documentos: se aplica al escribir o elegir, sin botón, y conserva el resto de filtros. */
export function FiltrosDocumentos({ empresas, categorias, ordenes }: Props) {
  const router = useRouter()
  const ruta = usePathname()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
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
        <Desplegable
          key={`e${sp.get('empresa') ?? ''}`}
          etiqueta="Empresa"
          vacia="Todas las empresas"
          opciones={empresas.map((e) => ({ valor: e.id, texto: e.nombre }))}
          valor={sp.get('empresa') ?? ''}
          alCambiar={(v) => ir({ empresa: v || null, categoria: null })}
        />
      )}
      {categorias && categorias.length > 0 && (
        <Desplegable
          key={`c${sp.get('empresa') ?? ''}-${sp.get('categoria') ?? ''}`}
          etiqueta="Instalación"
          vacia="Todas las instalaciones"
          opciones={categorias.map((c) => ({ valor: c.id, texto: c.nombre }))}
          valor={sp.get('categoria') ?? ''}
          alCambiar={(v) => ir({ categoria: v || null })}
        />
      )}
      <select className="input" aria-label="Ordenar por" value={sp.get('orden') ?? 'urgencia'} onChange={(e) => ir({ orden: e.target.value === 'urgencia' ? null : e.target.value })}>
        {ordenes.map((o) => <option key={o.id} value={o.id}>Orden: {o.texto}</option>)}
      </select>
      <RangoFechas
        key={`f${sp.get('desde') ?? ''}-${sp.get('hasta') ?? ''}`}
        etiqueta="Caducidad"
        atajos="futuro"
        desde={sp.get('desde')}
        hasta={sp.get('hasta')}
        alCambiar={(desde, hasta) => ir({ desde: desde || null, hasta: hasta || null })}
      />
    </form>
  )
}
