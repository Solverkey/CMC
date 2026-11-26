'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

type Props = { empresas: { id: string; nombre: string }[]; cmc: boolean }

const ESTADOS = [
  { valor: 'abierto', texto: 'Abiertas' },
  { valor: 'resuelto', texto: 'Resueltas' },
  { valor: 'todos', texto: 'Todas' },
]

/** Filtros de la bandeja: se aplican al momento y se conservan al cambiar de conversación. */
export function FiltrosBandeja({ empresas, cmc }: Props) {
  const router = useRouter()
  const ruta = usePathname()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  const reloj = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const con = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams(sp.toString())
    for (const [k, v] of Object.entries(cambios)) {
      if (v) p.set(k, v)
      else p.delete(k)
    }
    const qs = p.toString()
    return `${ruta}${qs ? `?${qs}` : ''}`
  }

  useEffect(() => () => clearTimeout(reloj.current), [])

  const estado = sp.get('estado') ?? 'abierto'
  return (
    <form className="bandeja__filtros" role="search" onSubmit={(e) => { e.preventDefault(); router.replace(con({ q: q.trim() || null })) }}>
      <input
        className="input"
        type="search"
        name="q"
        value={q}
        placeholder="Buscar por asunto o mensaje"
        aria-label="Buscar conversaciones"
        onChange={(e) => {
          const valor = e.target.value
          setQ(valor)
          clearTimeout(reloj.current)
          reloj.current = setTimeout(() => router.replace(con({ q: valor.trim() || null })), 400)
        }}
      />
      {empresas.length > 1 && (
        <select className="input" aria-label="Empresa" value={sp.get('empresa') ?? ''} onChange={(e) => router.replace(con({ empresa: e.target.value || null }))}>
          <option value="">Todas las empresas</option>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </select>
      )}
      <div className="row segmentado" role="group" aria-label="Estado">
        {ESTADOS.map((e) => (
          <Link key={e.valor} className="btn btn--ghost" aria-current={estado === e.valor ? 'true' : undefined} href={con({ estado: e.valor === 'abierto' ? null : e.valor })} replace>
            {e.texto}
          </Link>
        ))}
      </div>
      {cmc && (
        <label className="row small" style={{ gap: 6 }}>
          <input type="checkbox" checked={sp.has('mias')} onChange={(e) => router.replace(con({ mias: e.target.checked ? '1' : null }))} />
          Solo las asignadas a mí
        </label>
      )}
    </form>
  )
}
