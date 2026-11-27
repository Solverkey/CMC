'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

export type Opcion = { valor: string; texto: string }

type Props = {
  opciones: Opcion[]
  valor: string
  alCambiar?: (valor: string) => void
  /** Texto de la opción vacía («Todas las empresas»). Sin él no hay opción vacía. */
  vacia?: string
  etiqueta: string
  /** Para formularios normales: el valor elegido viaja en un campo oculto con este nombre. */
  name?: string
  placeholder?: string
  className?: string
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Desplegable en el que se puede escribir para buscar (combobox de la ARIA).
 * Se filtra sin distinguir mayúsculas ni acentos; flechas, Intro y Escape funcionan como en un desplegable normal.
 */
export function Desplegable({ opciones, valor, alCambiar, vacia, etiqueta, name, placeholder, className = '' }: Props) {
  const id = useId()
  const lista = `${id}-lista`
  const caja = useRef<HTMLDivElement>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const [elegido, setElegido] = useState(valor)
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [activo, setActivo] = useState(0)

  const todas = useMemo(() => (vacia ? [{ valor: '', texto: vacia }, ...opciones] : opciones), [opciones, vacia])
  const actual = todas.find((o) => o.valor === elegido)
  const filtradas = useMemo(() => {
    const q = normalizar(texto.trim())
    return q ? todas.filter((o) => normalizar(o.texto).includes(q)) : todas
  }, [todas, texto])

  // Cerrar al pulsar fuera.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    return () => document.removeEventListener('mousedown', fuera)
  }, [abierto])

  function abrir() {
    setTexto('')
    setActivo(Math.max(todas.findIndex((o) => o.valor === elegido), 0))
    setAbierto(true)
  }

  function elegir(o: Opcion) {
    setElegido(o.valor)
    setAbierto(false)
    setTexto('')
    if (o.valor !== elegido) alCambiar?.(o.valor)
  }

  return (
    <div ref={caja} className={`desplegable ${className}`}>
      {name && <input type="hidden" name={name} value={elegido} />}
      <input
        ref={entrada}
        className="input desplegable__entrada"
        role="combobox"
        aria-label={etiqueta}
        aria-expanded={abierto}
        aria-controls={lista}
        aria-autocomplete="list"
        aria-activedescendant={abierto && filtradas[activo] ? `${id}-${activo}` : undefined}
        autoComplete="off"
        placeholder={abierto ? (actual?.texto ?? placeholder ?? 'Escriba para buscar') : (placeholder ?? '')}
        value={abierto ? texto : (actual?.texto ?? '')}
        onFocus={abrir}
        onClick={() => !abierto && abrir()}
        onChange={(e) => {
          setTexto(e.target.value)
          setActivo(0)
          setAbierto(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!abierto) return abrir()
            setActivo((i) => Math.min(i + 1, filtradas.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActivo((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            if (abierto && filtradas[activo]) {
              e.preventDefault()
              elegir(filtradas[activo])
            }
          } else if (e.key === 'Escape') {
            setAbierto(false)
            setTexto('')
          } else if (e.key === 'Tab') {
            setAbierto(false)
          }
        }}
      />
      <svg className="desplegable__flecha" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {abierto && (
        <ul id={lista} role="listbox" aria-label={etiqueta} className="desplegable__lista">
          {filtradas.length === 0 && <li className="desplegable__vacio">Ninguna coincide con «{texto}»</li>}
          {filtradas.map((o, i) => (
            <li
              key={o.valor || '_vacia'}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.valor === elegido}
              className={`desplegable__opcion${i === activo ? ' desplegable__opcion--activa' : ''}`}
              onMouseEnter={() => setActivo(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                elegir(o)
                entrada.current?.blur()
              }}
            >
              {o.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
