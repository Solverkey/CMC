'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

/** Fechas como 'AAAA-MM-DD' en hora local (sin desfases de zona horaria). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const leer = (s?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '')
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
const sumarDias = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const sumarMeses = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)
const corto = (s: string) => leer(s)!.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
const largo = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const tituloMes = (d: Date) => {
  const t = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}
/** «21–27 nov 2026», «10 nov – 20 dic 2026» o, entre años, las dos fechas completas. */
function rangoCorto(a: string, b: string) {
  if (a === b) return corto(a)
  const [x, y] = [leer(a)!, leer(b)!]
  if (x.getFullYear() !== y.getFullYear()) return `${corto(a)} – ${corto(b)}`
  const mes = (d: Date) => d.toLocaleDateString('es-ES', { month: 'short' })
  if (x.getMonth() === y.getMonth()) return `${x.getDate()}–${y.getDate()} ${mes(y)} ${y.getFullYear()}`
  return `${x.getDate()} ${mes(x)} – ${y.getDate()} ${mes(y)} ${y.getFullYear()}`
}
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

type Atajo = { texto: string; rango: () => [string, string] }
const hoy = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
const ATAJOS: Record<'futuro' | 'pasado', Atajo[]> = {
  futuro: [
    { texto: 'Ya caducados', rango: () => ['', iso(sumarDias(hoy(), -1))] },
    { texto: 'Próximos 30 días', rango: () => [iso(hoy()), iso(sumarDias(hoy(), 30))] },
    { texto: 'Próximos 3 meses', rango: () => [iso(hoy()), iso(sumarDias(sumarMeses(hoy(), 3), hoy().getDate() - 1))] },
    { texto: 'Próximos 6 meses', rango: () => [iso(hoy()), iso(sumarDias(sumarMeses(hoy(), 6), hoy().getDate() - 1))] },
    { texto: 'Este año', rango: () => [`${hoy().getFullYear()}-01-01`, `${hoy().getFullYear()}-12-31`] },
    { texto: 'El año que viene', rango: () => [`${hoy().getFullYear() + 1}-01-01`, `${hoy().getFullYear() + 1}-12-31`] },
  ],
  pasado: [
    { texto: 'Hoy', rango: () => [iso(hoy()), iso(hoy())] },
    { texto: 'Últimos 7 días', rango: () => [iso(sumarDias(hoy(), -6)), iso(hoy())] },
    { texto: 'Últimos 30 días', rango: () => [iso(sumarDias(hoy(), -29)), iso(hoy())] },
    { texto: 'Este mes', rango: () => [iso(sumarMeses(hoy(), 0)), iso(hoy())] },
    { texto: 'El mes pasado', rango: () => [iso(sumarMeses(hoy(), -1)), iso(sumarDias(sumarMeses(hoy(), 0), -1))] },
    { texto: 'Este año', rango: () => [`${hoy().getFullYear()}-01-01`, iso(hoy())] },
  ],
}

type Props = {
  desde?: string | null
  hasta?: string | null
  /** Se llama al aplicar (o limpiar) con las fechas elegidas; '' si no hay. */
  alCambiar?: (desde: string, hasta: string) => void
  /** Si se da, el rango viaja en el formulario en dos campos ocultos con estos nombres. */
  nombres?: { desde: string; hasta: string }
  /** Qué se filtra, p. ej. «Caducidad». Se usa en el botón y para lectores de pantalla. */
  etiqueta: string
  /** Atajos pensados para fechas futuras (caducidades) o pasadas (registros). */
  atajos?: 'futuro' | 'pasado'
  className?: string
  /** Si el campo ya tiene su propia etiqueta visible, no se repite dentro del botón. */
  sinEtiquetaVisible?: boolean
}

/**
 * Selector de rango de fechas: un botón que abre un calendario (dos meses, uno en móvil) con atajos.
 * Primer clic, inicio; segundo clic, fin. Flechas, Re Pág/Av Pág, Intro y Escape funcionan dentro del calendario.
 */
export function RangoFechas({ desde, hasta, alCambiar, nombres, etiqueta, atajos = 'futuro', className = '', sinEtiquetaVisible }: Props) {
  const id = useId()
  const caja = useRef<HTMLDivElement>(null)
  const rejilla = useRef<HTMLDivElement>(null)
  const [abierto, setAbierto] = useState(false)
  // Valor aplicado (el que se ve en el botón y viaja en el formulario).
  const [aplicado, setAplicado] = useState<[string, string]>([desde ?? '', hasta ?? ''])
  // Borrador mientras el calendario está abierto.
  const [ini, setIni] = useState<string>('')
  const [fin, setFin] = useState<string>('')
  const [sobre, setSobre] = useState<string | null>(null)
  const [mes, setMes] = useState<Date>(() => sumarMeses(hoy(), 0))
  const [foco, setFoco] = useState<string>('')
  const [teclado, setTeclado] = useState(false)
  const [derecha, setDerecha] = useState(false)

  function abrir() {
    const [a, b] = aplicado
    setIni(a)
    setFin(b)
    setSobre(null)
    const base = leer(a) ?? leer(b) ?? hoy()
    setMes(new Date(base.getFullYear(), base.getMonth(), 1))
    setFoco(iso(base))
    setTeclado(false)
    setAbierto(true)
  }

  function aplicar(a: string, b: string) {
    setAplicado([a, b])
    setAbierto(false)
    alCambiar?.(a, b)
  }

  // Cerrar al pulsar fuera.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  // Si el panel no cabe a la derecha, se alinea por la derecha del botón.
  useLayoutEffect(() => {
    if (!abierto || !caja.current) return
    const r = caja.current.getBoundingClientRect()
    setDerecha(r.left + 660 > window.innerWidth)
  }, [abierto])

  // Con teclado, el foco sigue al día activo.
  useEffect(() => {
    if (abierto && teclado) rejilla.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus()
  }, [abierto, teclado, foco])

  function elegir(dia: string) {
    if (!ini || fin) {
      setIni(dia)
      setFin('')
    } else if (dia < ini) {
      setIni(dia)
    } else {
      setFin(dia)
    }
    setFoco(dia)
  }

  function mover(dias: number, meses = 0) {
    const base = leer(foco) ?? hoy()
    const nuevo = meses ? new Date(base.getFullYear(), base.getMonth() + meses, Math.min(base.getDate(), 28)) : sumarDias(base, dias)
    const nf = iso(nuevo)
    setFoco(nf)
    setTeclado(true)
    // Mantener el día enfocado a la vista (se ven dos meses: el actual y el siguiente).
    const primero = mes
    const ultimo = sumarDias(sumarMeses(mes, 2), -1)
    if (nuevo < primero) setMes(new Date(nuevo.getFullYear(), nuevo.getMonth(), 1))
    else if (nuevo > ultimo) setMes(new Date(nuevo.getFullYear(), nuevo.getMonth() - 1, 1))
  }

  function teclas(e: React.KeyboardEvent) {
    const mapa: Record<string, () => void> = {
      ArrowLeft: () => mover(-1),
      ArrowRight: () => mover(1),
      ArrowUp: () => mover(-7),
      ArrowDown: () => mover(7),
      PageUp: () => mover(0, -1),
      PageDown: () => mover(0, 1),
      Home: () => mover(-(((leer(foco) ?? hoy()).getDay() + 6) % 7)),
      End: () => mover(6 - (((leer(foco) ?? hoy()).getDay() + 6) % 7)),
    }
    if (mapa[e.key]) {
      e.preventDefault()
      mapa[e.key]()
    }
  }

  const [a, b] = aplicado
  const texto = a && b ? rangoCorto(a, b) : a ? `Desde el ${corto(a)}` : b ? `Hasta el ${corto(b)}` : 'Cualquier fecha'
  // Extremo provisional mientras se pasa el ratón con solo el inicio elegido.
  const finVista = fin || (ini && sobre && sobre >= ini ? sobre : '')
  const hoyIso = abierto ? iso(hoy()) : ''
  const atajo = ATAJOS[atajos].find((x) => {
    const [p, q] = x.rango()
    return p === ini && q === fin
  })

  function pintarMes(inicio: Date, segundo = false) {
    const huecos = (inicio.getDay() + 6) % 7
    const total = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0).getDate()
    const dias = Array.from({ length: total }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), i + 1))
    return (
      <div className={`rango__mes${segundo ? ' rango__mes--segundo' : ''}`}>
        <p className="rango__titulo" id={`${id}-${iso(inicio)}`}>{tituloMes(inicio)}</p>
        <div className="rango__dias" role="grid" aria-labelledby={`${id}-${iso(inicio)}`}>
          <div role="row" className="rango__semana">
            {DIAS.map((d) => <span key={d} role="columnheader" className="rango__cab">{d}</span>)}
          </div>
          <div role="row" className="rango__semana rango__semana--dias">
            {Array.from({ length: huecos }, (_, i) => <span key={`h${i}`} role="gridcell" />)}
            {dias.map((d) => {
              const k = iso(d)
              const esIni = k === ini
              const esFin = k === (finVista || ini) && Boolean(ini)
              const dentro = Boolean(ini && finVista && k > ini && k < finVista)
              const clases = ['rango__dia', esIni && 'rango__dia--ini', esFin && 'rango__dia--fin', dentro && 'rango__dia--dentro', k === hoyIso && 'rango__dia--hoy', !fin && sobre && k === finVista && 'rango__dia--provisional']
              return (
                <span key={k} role="gridcell" aria-selected={esIni || esFin || dentro}>
                  <button
                    type="button"
                    data-dia={k}
                    tabIndex={k === foco ? 0 : -1}
                    className={clases.filter(Boolean).join(' ')}
                    aria-label={`${largo(d)}${esIni ? ', inicio' : ''}${esFin && fin ? ', fin' : ''}`}
                    aria-current={k === hoyIso ? 'date' : undefined}
                    onClick={() => elegir(k)}
                    onMouseEnter={() => setSobre(k)}
                    onFocus={() => setSobre(k)}
                  >
                    {d.getDate()}
                  </button>
                </span>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={caja} className={`rango ${className}`} onKeyDown={(e) => { if (e.key === 'Escape' && abierto) { e.stopPropagation(); setAbierto(false) } }}>
      {nombres && (
        <>
          <input type="hidden" name={nombres.desde} value={a} />
          <input type="hidden" name={nombres.hasta} value={b} />
        </>
      )}
      <button
        type="button"
        className={`rango__boton input${a || b ? ' rango__boton--activo' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        aria-controls={`${id}-panel`}
        aria-label={`${etiqueta}: ${texto}`}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
      >
        <Icon name="calendar" size={16} />
        {!sinEtiquetaVisible && <span className="rango__etiqueta">{etiqueta}:</span>}
        <span className="rango__valor">{texto}</span>
        <Icon name="chevron" size={14} />
      </button>
      {(a || b) && !abierto && (
        <button type="button" className="rango__quitar" aria-label={`Quitar el filtro de ${etiqueta.toLowerCase()}`} onClick={() => aplicar('', '')}>
          <Icon name="close" size={14} />
        </button>
      )}

      {abierto && (
        <div id={`${id}-panel`} role="dialog" aria-label={`Elegir fechas de ${etiqueta.toLowerCase()}`} className={`rango__panel${derecha ? ' rango__panel--derecha' : ''}`}>
          <ul className="rango__atajos" aria-label="Atajos">
            {ATAJOS[atajos].map((x) => (
              <li key={x.texto}>
                <button
                  type="button"
                  aria-pressed={atajo?.texto === x.texto}
                  onClick={() => {
                    const [p, q] = x.rango()
                    setIni(p)
                    setFin(q)
                    const base = leer(p) ?? leer(q)!
                    setMes(new Date(base.getFullYear(), base.getMonth(), 1))
                    setFoco(iso(base))
                  }}
                >
                  {x.texto}
                </button>
              </li>
            ))}
          </ul>
          <div className="rango__calendario">
            <div className="rango__nav">
              <button type="button" className="rango__flecha" aria-label="Mes anterior" onClick={() => setMes((m) => sumarMeses(m, -1))}>‹</button>
              <button type="button" className="rango__flecha" aria-label="Mes siguiente" onClick={() => setMes((m) => sumarMeses(m, 1))}>›</button>
            </div>
            <div className="rango__meses" ref={rejilla} onKeyDown={teclas} onMouseLeave={() => setSobre(null)}>
              {pintarMes(mes)}
              {pintarMes(sumarMeses(mes, 1), true)}
            </div>
            <div className="rango__pie">
              <p className="small muted" aria-live="polite">
                {!ini && !fin ? 'Elija la fecha de inicio.' : ini && !fin ? `Desde el ${corto(ini)}. Elija la fecha final (o aplique sin ella).` : !ini ? `Hasta el ${corto(fin)}.` : `Del ${corto(ini)} al ${corto(fin)}.`}
              </p>
              <div className="row" style={{ gap: 8 }}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setIni(''); setFin('') }} disabled={!ini && !fin}>Limpiar</button>
                <button type="button" className="btn btn--primary btn--sm" onClick={() => aplicar(ini, fin)}>Aplicar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
