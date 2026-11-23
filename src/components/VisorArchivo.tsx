'use client'

import { useEffect, useRef, useState } from 'react'
import { urlDelSitio } from '@/lib/urlFichero'

/** Vista del archivo dentro de la ficha (RF-09). PDF, Word, Excel e imágenes se ven en la página. */
export function VisorArchivo({ url, nombre, mime }: { url: string; nombre: string; mime?: string | null }) {
  const tipo = (mime ?? '').toLowerCase()
  const archivo = nombre.toLowerCase()
  if (tipo === 'application/pdf' || archivo.endsWith('.pdf')) return <VisorPdf url={url} nombre={nombre} />
  if (esWord(tipo, archivo)) return <VisorWord url={url} nombre={nombre} antiguo={archivo.endsWith('.doc') && !archivo.endsWith('.docx')} />
  if (esExcel(tipo, archivo)) return <VisorExcel url={url} nombre={nombre} />
  if (tipo.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(archivo)) return <VisorImagen url={url} nombre={nombre} />
  return <p className="muted">Este archivo no se puede mostrar aquí. Use Descargar para abrirlo.</p>
}

const esWord = (tipo: string, archivo: string) =>
  tipo.includes('word') || archivo.endsWith('.docx') || archivo.endsWith('.doc')

const esExcel = (tipo: string, archivo: string) =>
  tipo.includes('excel') || tipo.includes('spreadsheet') || /\.xlsx?$/.test(archivo)

async function bytesDe(url: string) {
  const res = await fetch(urlDelSitio(url), { credentials: 'include' })
  if (!res.ok) throw new Error('No se ha podido leer el archivo.')
  return new Uint8Array(await res.arrayBuffer())
}

/** Safari no pinta un PDF dentro de un iframe y lo manda a Descargas. Se dibuja la página aquí. */
function VisorPdf({ url, nombre }: { url: string; nombre: string }) {
  const caja = useRef<HTMLDivElement>(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    const nodo = caja.current
    if (!nodo) return
    let vivo = true
    const pendientes: { cancel: () => void }[] = []

    ;(async () => {
      const pdfjs = await import('pdfjs-dist')
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      const res = await fetch(urlDelSitio(url), { credentials: 'include' })
      if (!res.ok) throw new Error('No se ha podido leer el archivo.')
      const datos = new Uint8Array(await res.arrayBuffer())
      const doc = await pdfjs.getDocument({ data: datos }).promise
      if (!vivo) return
      nodo.replaceChildren()
      const ancho = nodo.clientWidth || 640
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i)
        if (!vivo) return
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: Math.max(1, ancho / base.width) })
        const canvas = document.createElement('canvas')
        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = '100%'
        canvas.style.height = 'auto'
        canvas.setAttribute('aria-label', `Página ${i} de ${nombre}`)
        nodo.appendChild(canvas)
        const ctx = canvas.getContext('2d')
        if (!ctx) continue
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        const render = page.render({ canvasContext: ctx, canvas, viewport })
        pendientes.push(render)
        await render.promise
      }
    })().catch(() => {
      if (vivo) setFallo(true)
    })

    return () => {
      vivo = false
      for (const render of pendientes) render.cancel()
    }
  }, [url, nombre])

  if (fallo) return <p className="muted">No se ha podido mostrar el archivo. Use Descargar para abrirlo.</p>
  return <div ref={caja} className="visor visor--pdf" role="img" aria-label={`Vista previa de ${nombre}`} />
}

const MAX_FILAS = 300
const MAX_COLUMNAS = 40

function VisorImagen({ url, nombre }: { url: string; nombre: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => { setSrc(urlDelSitio(url)) }, [url])
  if (!src) return <div className="visor" />
  // eslint-disable-next-line @next/next/no-img-element -- el archivo puede venir de S3 y ya está comprimido
  return <img className="visor" src={src} alt={nombre} />
}

/** El Word .docx se dibuja en la página. El .doc antiguo no tiene vista. */
function VisorWord({ url, nombre, antiguo }: { url: string; nombre: string; antiguo: boolean }) {
  const caja = useRef<HTMLDivElement>(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (antiguo) return
    const nodo = caja.current
    if (!nodo) return
    let vivo = true
    ;(async () => {
      const { renderAsync } = await import('docx-preview')
      const datos = await bytesDe(url)
      if (!vivo) return
      nodo.replaceChildren()
      await renderAsync(datos, nodo, nodo, { className: 'docx', inWrapper: true, ignoreWidth: true, breakPages: true })
    })().catch(() => {
      if (vivo) setFallo(true)
    })
    return () => {
      vivo = false
    }
  }, [url, antiguo])

  if (antiguo) return <p className="muted">Los Word antiguos (.doc) no se pueden mostrar aquí. Guárdelo como .docx o use Descargar.</p>
  if (fallo) return <p className="muted">No se ha podido mostrar el archivo. Use Descargar para abrirlo.</p>
  return <div ref={caja} className="visor visor--office" aria-label={`Vista previa de ${nombre}`} />
}

type Hoja = { nombre: string; filas: string[][]; cortada: boolean }

/** Excel en tabla, con una pestaña por hoja. */
function VisorExcel({ url, nombre }: { url: string; nombre: string }) {
  const [hojas, setHojas] = useState<Hoja[] | null>(null)
  const [activa, setActiva] = useState(0)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const XLSX = await import('xlsx')
      const datos = await bytesDe(url)
      const libro = XLSX.read(datos, { type: 'array' })
      if (!vivo) return
      setHojas(libro.SheetNames.map((nombreHoja) => {
        const bruta = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(libro.Sheets[nombreHoja], { header: 1, raw: false, defval: '' })
        const cortada = bruta.length > MAX_FILAS
        const filas = bruta.slice(0, MAX_FILAS).map((fila) => fila.slice(0, MAX_COLUMNAS).map((celda) => (celda == null ? '' : String(celda))))
        return { nombre: nombreHoja, filas, cortada }
      }))
    })().catch(() => {
      if (vivo) setFallo(true)
    })
    return () => {
      vivo = false
    }
  }, [url])

  if (fallo) return <p className="muted">No se ha podido mostrar el archivo. Use Descargar para abrirlo.</p>
  if (!hojas) return <div className="visor visor--office" aria-label={`Vista previa de ${nombre}`} />
  const hoja = hojas[activa] ?? hojas[0]
  if (!hoja) return <p className="muted">El Excel no tiene hojas.</p>
  const ancho = Math.max(1, ...hoja.filas.map((f) => f.length))
  return (
    <div className="visor visor--office" aria-label={`Vista previa de ${nombre}`}>
      {hojas.length > 1 && (
        <div className="hojas" role="tablist">
          {hojas.map((h, i) => (
            <button key={h.nombre} type="button" className={i === activa ? 'is-active' : ''} role="tab" aria-selected={i === activa} onClick={() => setActiva(i)}>{h.nombre}</button>
          ))}
        </div>
      )}
      {hoja.filas.length === 0 ? <p className="muted">Esta hoja está vacía.</p> : (
        <table>
          <tbody>
            {hoja.filas.map((fila, y) => (
              <tr key={y}>
                {Array.from({ length: ancho }, (_, x) => <td key={x}>{fila[x] ?? ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {hoja.cortada && <p className="small muted">Se muestran las primeras {MAX_FILAS} filas. Descargue el archivo para verlo entero.</p>}
    </div>
  )
}
