'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Icon } from './Icon'

type Props = {
  empresaId: string
  hiloId?: string
  documentoId?: string
  categoriaId?: string
  asunto?: string
  /** Texto de contexto de una conversación nueva (documento o categoría). */
  sobre?: string
  /** Empresas entre las que elegir al empezar una conversación (si hay más de una). */
  empresas?: { id: string; nombre: string }[]
  /** Filtros de la bandeja que se conservan al abrir la conversación creada. */
  filtros?: string
}

const MAX = 50 * 1024 * 1024
const tamano = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`)
const error = async (res: Response, def: string) => (await res.json().catch(() => null))?.errors?.[0]?.message ?? def

/**
 * Redactor de la comunicación: respuesta dentro de una conversación o conversación nueva, con adjuntos.
 * Ctrl+Intro (o Cmd+Intro) envía. Los mensajes no se pueden editar ni borrar.
 */
export function MensajeForm({ empresaId, hiloId, documentoId, categoriaId, asunto, sobre, empresas, filtros = '' }: Props) {
  const router = useRouter()
  const ruta = usePathname()
  const input = useRef<HTMLInputElement>(null)
  const [ficheros, setFicheros] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function enviar(form: HTMLFormElement) {
    if (enviando) return
    const datos = new FormData(form)
    const texto = String(datos.get('texto') ?? '').trim()
    if (!texto) return setFallo('Escriba el mensaje.')
    setFallo(null)
    setEnviando(true)
    try {
      const adjuntos: number[] = []
      for (const f of ficheros) {
        const body = new FormData()
        body.append('file', f)
        body.append('_payload', JSON.stringify({ empresa: Number(empresaId) }))
        const res = await fetch('/api/adjuntos', { method: 'POST', body, credentials: 'include' })
        if (!res.ok) throw new Error(`${f.name}: ${await error(res, 'no se ha podido subir')}`)
        adjuntos.push((await res.json()).doc.id)
      }
      let hilo = hiloId
      if (!hilo) {
        const res = await fetch('/api/hilos', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            empresa: Number(empresaId),
            asunto: String(datos.get('asunto') ?? asunto ?? '').trim(),
            texto,
            adjuntos,
            documento: documentoId ? Number(documentoId) : undefined,
            categoria: categoriaId ? Number(categoriaId) : undefined,
          }),
        })
        if (!res.ok) throw new Error(await error(res, 'No se ha podido crear la conversación.'))
        hilo = String((await res.json()).doc.id)
      } else {
        const res = await fetch('/api/mensajes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hilo: Number(hilo), texto, adjuntos }) })
        if (!res.ok) throw new Error(await error(res, 'No se ha podido enviar el mensaje.'))
      }
      form.reset()
      setFicheros([])
      if (hiloId) router.refresh()
      else router.push(`/portal/mensajes/${hilo}${filtros}`)
    } catch (err) {
      setFallo((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form
      className="redactor"
      onSubmit={(e) => {
        e.preventDefault()
        void enviar(e.currentTarget)
      }}
    >
      {!hiloId && (
        <>
          {empresas && empresas.length > 1 && (
            <div className="field">
              <label htmlFor="empresa-nueva">Empresa</label>
              <select id="empresa-nueva" value={empresaId} onChange={(e) => router.replace(`${ruta}?empresa=${e.target.value}`)}>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
            </div>
          )}
          {sobre && <p className="small muted">Sobre: {sobre}</p>}
          <div className="field">
            <label htmlFor="asunto">Asunto</label>
            <input id="asunto" name="asunto" required defaultValue={asunto} maxLength={200} />
          </div>
          <label htmlFor="texto" className="small" style={{ fontWeight: 600 }}>Mensaje</label>
        </>
      )}
      <textarea
        id="texto"
        name="texto"
        rows={hiloId ? 2 : 6}
        required
        maxLength={10000}
        placeholder={hiloId ? 'Escriba una respuesta… (Ctrl+Intro para enviar)' : 'Escriba su consulta'}
        aria-label={hiloId ? 'Respuesta' : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            if (e.currentTarget.form) void enviar(e.currentTarget.form)
          }
        }}
      />
      <div className="redactor__pie">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => input.current?.click()}><Icon name="paperclip" />Adjuntar</button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".pdf,image/*,.heic,.heif,.doc,.docx,.xls,.xlsx"
          onChange={(e) => {
            const elegidos = Array.from(e.target.files ?? [])
            const grandes = elegidos.filter((f) => f.size > MAX)
            setFicheros((p) => [...p, ...elegidos.filter((f) => f.size <= MAX)])
            setFallo(grandes.length ? `No se adjunta${grandes.length > 1 ? 'n' : ''} ${grandes.map((f) => `«${f.name}»`).join(', ')}: el máximo es 50 MB por archivo.` : null)
            e.target.value = ''
          }}
        />
        {ficheros.map((f, i) => (
          <span key={i} className="tag">
            {f.name} · {tamano(f.size)} <button type="button" className="enlace" aria-label={`Quitar ${f.name}`} onClick={() => setFicheros((p) => p.filter((_, j) => j !== i))}>×</button>
          </span>
        ))}
        <button className="btn btn--primary btn--sm" disabled={enviando}><Icon name="arrow" />{enviando ? 'Enviando…' : 'Enviar'}</button>
      </div>
      {fallo && <p role="alert" className="alert alert--error">{fallo}</p>}
    </form>
  )
}
