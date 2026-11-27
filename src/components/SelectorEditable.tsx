'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { RespuestaSelector } from '@/app/(frontend)/portal/acciones'
import { Icon } from './Icon'

export type OpcionEditable = { valor: string; texto: string; nota?: string }
type Accion<T> = Promise<RespuestaSelector<T>>

const EFECTOS = [
  { value: 'sustituye', label: 'Sustituye al vigente' },
  { value: 'actualiza_fechas', label: 'Actualiza fechas' },
  { value: 'levanta', label: 'Puede levantar la condición' },
  { value: 'complementario', label: 'Complementario' },
]

type Props = {
  etiqueta: string
  id?: string
  /** Nombre del campo del formulario. */
  name: string
  opciones?: OpcionEditable[]
  /** Carga perezosa de las opciones al abrir por primera vez (catálogos). */
  cargar?: () => Accion<OpcionEditable[]>
  valor?: string
  /** El valor es el propio texto (nombres libres con sugerencias). Si no, hay que elegir una opción. */
  libre?: boolean
  required?: boolean
  placeholder?: string
  /** Sugerencias que no son opciones todavía (p. ej. nombres del catálogo): elegirlas las crea. */
  sugerencias?: { titulo: string; cargar: () => Accion<OpcionEditable[]> }
  crear?: (nombre: string, efectos?: string[]) => Accion<OpcionEditable>
  renombrar?: (o: OpcionEditable, nombre: string) => Accion<OpcionEditable>
  quitar?: (o: OpcionEditable) => Accion<{ mensaje: string }>
  /** Información antes de renombrar o quitar («lo usan 4 documentos»). */
  aviso?: (o: OpcionEditable, modo: 'renombrar' | 'quitar') => Promise<string | null>
  textoCrear?: (nombre: string) => string
  /** Al crear, pedir el efecto sobre el documento (tipos de relación). */
  conEfectos?: boolean
  alCambiar?: (valor: string) => void
}

type Modo =
  | { tipo: 'renombrar'; o: OpcionEditable; texto: string; aviso: string | null }
  | { tipo: 'quitar'; o: OpcionEditable; aviso: string | null }
  | { tipo: 'crear'; nombre: string; efectos: string[] }
  | null

type Fila = { clase: 'opcion' | 'sugerencia' | 'crear'; o: OpcionEditable }

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Desplegable con búsqueda en el que CMC también crea, renombra y quita opciones sin salir del formulario.
 * Teclado: flechas e Intro para elegir; F2 renombra y Mayús+Supr quita la opción marcada; Escape cierra.
 */
export function SelectorEditable(p: Props) {
  const { etiqueta, name, libre, required, placeholder, sugerencias, crear, renombrar, quitar, aviso, conEfectos } = p
  const uid = useId()
  const idEntrada = p.id ?? `${uid}-entrada`
  const lista = `${uid}-lista`
  const caja = useRef<HTMLDivElement>(null)
  const entrada = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [opciones, setOpciones] = useState<OpcionEditable[]>(p.opciones ?? [])
  const [cargadas, setCargadas] = useState(!p.cargar)
  const [sugeridas, setSugeridas] = useState<OpcionEditable[] | null>(null)
  const [elegido, setElegido] = useState(p.valor ?? '')
  const [filtro, setFiltro] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const [modo, setModo] = useState<Modo>(null)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState<string | null>(null)
  const editable = Boolean(renombrar || quitar)

  const actual = opciones.find((o) => o.valor === elegido)
  const textoVisible = libre ? elegido : (actual?.texto ?? '')

  const filas = useMemo<Fila[]>(() => {
    const q = normalizar(filtro)
    const coincide = (o: OpcionEditable) => !q || normalizar(o.texto).includes(q)
    const propias = opciones.filter(coincide).map((o) => ({ clase: 'opcion' as const, o }))
    const yaEstan = new Set(opciones.map((o) => normalizar(o.texto)))
    const extra = (sugeridas ?? []).filter((o) => !yaEstan.has(normalizar(o.texto)) && coincide(o)).map((o) => ({ clase: 'sugerencia' as const, o }))
    const exacta = [...opciones, ...(sugeridas ?? [])].some((o) => normalizar(o.texto) === q)
    const nueva = crear && q && !exacta ? [{ clase: 'crear' as const, o: { valor: filtro.trim(), texto: filtro.trim() } }] : []
    return [...propias, ...extra, ...nueva]
  }, [opciones, sugeridas, filtro, crear])

  // Validación nativa del formulario cuando el valor va en un campo oculto.
  useEffect(() => {
    if (!libre && required) entrada.current?.setCustomValidity(elegido ? '' : `Elija ${etiqueta.toLowerCase()}.`)
  }, [elegido, libre, required, etiqueta])

  // Cerrar al pulsar fuera.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) cerrar()
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  })

  // Al entrar en un modo, el foco va a su control.
  useEffect(() => {
    if (modo) panel.current?.querySelector<HTMLElement>('input:not([type=checkbox]), button[data-principal]')?.focus()
  }, [modo])

  useEffect(() => {
    if (!estado) return
    const t = setTimeout(() => setEstado(null), 6000)
    return () => clearTimeout(t)
  }, [estado])

  async function abrir() {
    setFiltro('')
    setModo(null)
    setError(null)
    setActivo(Math.max(opciones.findIndex((o) => o.valor === elegido), 0))
    setAbierto(true)
    if (!cargadas && p.cargar) {
      setCargadas(true)
      const r = await p.cargar()
      if (r.ok) setOpciones(r.dato)
    }
    if (sugerencias && sugeridas === null) {
      setSugeridas([])
      const r = await sugerencias.cargar()
      if (r.ok) setSugeridas(r.dato)
    }
  }

  function cerrar() {
    setAbierto(false)
    setModo(null)
    setFiltro('')
  }

  function elegir(o: OpcionEditable) {
    setElegido(o.valor)
    cerrar()
    if (o.valor !== elegido) p.alCambiar?.(o.valor)
  }

  async function ejecutar<T>(accion: Accion<T>, hecho: (dato: T) => void) {
    setOcupado(true)
    setError(null)
    const r = await accion
    setOcupado(false)
    if (!r.ok) return setError(r.error)
    hecho(r.dato)
  }

  function crearDesde(nombre: string) {
    if (!crear) return
    if (conEfectos) return setModo({ tipo: 'crear', nombre, efectos: [] })
    void ejecutar(crear(nombre), (o) => {
      setOpciones((l) => [...l.filter((x) => x.valor !== o.valor), o].sort((a, b) => a.texto.localeCompare(b.texto, 'es')))
      setEstado(`«${o.texto}» creada.`)
      elegir(o)
    })
  }

  function activar(f: Fila) {
    if (f.clase === 'opcion') elegir(f.o)
    else crearDesde(f.o.texto)
  }

  async function entrarEn(tipo: 'renombrar' | 'quitar', o: OpcionEditable) {
    setError(null)
    const info = aviso ? await aviso(o, tipo) : null
    setModo(tipo === 'renombrar' ? { tipo, o, texto: o.texto, aviso: info } : { tipo, o, aviso: info })
  }

  function guardarNombre() {
    if (modo?.tipo !== 'renombrar' || !renombrar) return
    const viejo = modo.o
    void ejecutar(renombrar(viejo, modo.texto), (o) => {
      setOpciones((l) => l.map((x) => (x.valor === viejo.valor ? o : x)))
      if (elegido === viejo.valor) setElegido(o.valor)
      setModo(null)
      setEstado(`Renombrada a «${o.texto}».`)
      entrada.current?.focus()
    })
  }

  function confirmarQuitar() {
    if (modo?.tipo !== 'quitar' || !quitar) return
    const o = modo.o
    void ejecutar(quitar(o), (r) => {
      setOpciones((l) => l.filter((x) => x.valor !== o.valor))
      if (elegido === o.valor) setElegido('')
      setModo(null)
      setEstado(r.mensaje)
      entrada.current?.focus()
    })
  }

  function confirmarCrear() {
    if (modo?.tipo !== 'crear' || !crear) return
    if (!modo.efectos.length) return setError('Marque al menos un efecto.')
    void ejecutar(crear(modo.nombre, modo.efectos), (o) => {
      setOpciones((l) => [...l, o].sort((a, b) => a.texto.localeCompare(b.texto, 'es')))
      setEstado(`«${o.texto}» creada.`)
      elegir(o)
    })
  }

  const filaActiva = filas[activo]

  return (
    <div ref={caja} className="desplegable selector">
      {!libre && <input type="hidden" name={name} value={elegido} />}
      <input
        ref={entrada}
        id={idEntrada}
        name={libre ? name : undefined}
        className="input desplegable__entrada"
        role="combobox"
        aria-label={etiqueta}
        aria-expanded={abierto}
        aria-controls={lista}
        aria-autocomplete="list"
        aria-activedescendant={abierto && filaActiva ? `${uid}-${activo}` : undefined}
        aria-describedby={editable ? `${uid}-ayuda` : undefined}
        autoComplete="off"
        required={libre ? required : undefined}
        placeholder={abierto && !libre ? (actual?.texto ?? placeholder ?? 'Escriba para buscar') : (placeholder ?? '')}
        value={abierto && !libre ? filtro : textoVisible}
        onFocus={() => !abierto && void abrir()}
        onClick={() => !abierto && void abrir()}
        onChange={(e) => {
          const v = e.target.value
          setFiltro(v)
          if (libre) setElegido(v)
          setActivo(0)
          setModo(null)
          if (!abierto) setAbierto(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            if (!abierto) return void abrir()
            setActivo((i) => Math.min(i + 1, filas.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActivo((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            if (abierto && filaActiva) {
              e.preventDefault()
              activar(filaActiva)
            }
          } else if (e.key === 'Escape') {
            if (abierto) {
              e.preventDefault()
              e.stopPropagation()
            }
            cerrar()
          } else if (e.key === 'Tab') {
            cerrar()
          } else if (e.key === 'F2' && renombrar && filaActiva?.clase === 'opcion') {
            e.preventDefault()
            void entrarEn('renombrar', filaActiva.o)
          } else if (e.key === 'Delete' && e.shiftKey && quitar && filaActiva?.clase === 'opcion') {
            e.preventDefault()
            void entrarEn('quitar', filaActiva.o)
          }
        }}
      />
      <svg className="desplegable__flecha" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {editable && <span id={`${uid}-ayuda`} hidden>Puede crear, renombrar (F2) o quitar (Mayús+Supr) opciones desde aquí.</span>}
      {estado && !abierto && <span className="hint selector__estado" role="status">{estado}</span>}

      {abierto && (
        <div className="desplegable__lista selector__caja" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setModo(null); entrada.current?.focus() } }}>
          <ul id={lista} role="listbox" aria-label={etiqueta} className="selector__lista">
            {p.cargar && !cargadas && <li className="desplegable__vacio">Cargando…</li>}
            {filas.length === 0 && (
              <li className="desplegable__vacio">{filtro ? `Ninguna coincide con «${filtro}»` : crear ? 'Todavía no hay opciones: escriba para crear la primera.' : 'No hay opciones.'}</li>
            )}
            {filas.map((f, i) => {
              const primeraSugerencia = f.clase === 'sugerencia' && filas[i - 1]?.clase !== 'sugerencia'
              return (
                <li key={`${f.clase}-${f.o.valor}`} role="presentation" className="selector__grupo">
                  {primeraSugerencia && <span className="selector__titulo" aria-hidden="true">{sugerencias?.titulo}</span>}
                  <div
                    id={`${uid}-${i}`}
                    role="option"
                    aria-selected={f.clase === 'opcion' && f.o.valor === elegido}
                    className={`desplegable__opcion selector__opcion selector__opcion--${f.clase}${i === activo ? ' desplegable__opcion--activa' : ''}`}
                    onMouseEnter={() => setActivo(i)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      activar(f)
                    }}
                  >
                    {f.clase !== 'opcion' && <span className="selector__mas" aria-hidden="true">+</span>}
                    <span className="selector__texto">
                      {f.clase === 'crear' ? (p.textoCrear ?? ((n: string) => `Crear «${n}»`))(f.o.texto) : f.o.texto}
                      {f.o.nota && <span className="selector__nota">{f.o.nota}</span>}
                    </span>
                    {f.clase === 'opcion' && editable && (
                      <span className="selector__acciones">
                        {renombrar && (
                          <button type="button" tabIndex={-1} className="selector__accion" aria-label={`Renombrar «${f.o.texto}»`} title="Renombrar (F2)" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); void entrarEn('renombrar', f.o) }}>
                            <Icon name="pencil" size={14} />
                          </button>
                        )}
                        {quitar && (
                          <button type="button" tabIndex={-1} className="selector__accion selector__accion--quitar" aria-label={`Quitar «${f.o.texto}»`} title="Quitar (Mayús+Supr)" onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); void entrarEn('quitar', f.o) }}>
                            <Icon name="trash" size={14} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          {modo && (
            <div ref={panel} className="selector__panel" role="group" aria-label={modo.tipo === 'renombrar' ? 'Renombrar opción' : modo.tipo === 'quitar' ? 'Quitar opción' : 'Crear opción'}>
              {modo.tipo === 'renombrar' && (
                <>
                  <label className="small" htmlFor={`${uid}-renombrar`}>Nuevo nombre para «{modo.o.texto}»</label>
                  <input
                    id={`${uid}-renombrar`}
                    className="input"
                    value={modo.texto}
                    onChange={(e) => setModo({ ...modo, texto: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardarNombre() } }}
                  />
                  {modo.aviso && <span className="hint">{modo.aviso}</span>}
                  <div className="row selector__botones">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setModo(null); entrada.current?.focus() }}>Cancelar</button>
                    <button type="button" className="btn btn--primary btn--sm" onClick={guardarNombre} disabled={ocupado || !modo.texto.trim()}>{ocupado ? 'Guardando…' : 'Guardar'}</button>
                  </div>
                </>
              )}
              {modo.tipo === 'quitar' && (
                <>
                  <p className="small" style={{ margin: 0 }}><strong>¿Quitar «{modo.o.texto}»?</strong> {modo.aviso}</p>
                  <div className="row selector__botones">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setModo(null); entrada.current?.focus() }}>Cancelar</button>
                    <button type="button" data-principal className="btn btn--peligro btn--sm" onClick={confirmarQuitar} disabled={ocupado}>{ocupado ? 'Quitando…' : 'Quitar'}</button>
                  </div>
                </>
              )}
              {modo.tipo === 'crear' && (
                <>
                  <p className="small" style={{ margin: 0 }}><strong>Nuevo tipo «{modo.nombre}».</strong> ¿Qué efecto tiene sobre el documento?</p>
                  <div className="selector__efectos">
                    {EFECTOS.map((ef) => (
                      <label key={ef.value} className="row small" style={{ gap: 6 }}>
                        <input
                          type="checkbox"
                          checked={modo.efectos.includes(ef.value)}
                          onChange={(e) => setModo({ ...modo, efectos: e.target.checked ? [...modo.efectos, ef.value] : modo.efectos.filter((x) => x !== ef.value) })}
                        />
                        {ef.label}
                      </label>
                    ))}
                  </div>
                  <div className="row selector__botones">
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => { setModo(null); entrada.current?.focus() }}>Cancelar</button>
                    <button type="button" data-principal className="btn btn--primary btn--sm" onClick={confirmarCrear} disabled={ocupado}>{ocupado ? 'Creando…' : 'Crear'}</button>
                  </div>
                </>
              )}
            </div>
          )}
          {error && <p role="alert" className="selector__error">{error}</p>}
          {estado && !modo && !error && <p role="status" className="selector__ok">{estado}</p>}
          {editable && !modo && <p className="selector__pie" aria-hidden="true">Pase el ratón por una opción para renombrarla o quitarla · F2 renombrar · Mayús+Supr quitar</p>}
        </div>
      )}
    </div>
  )
}
