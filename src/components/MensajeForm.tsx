'use client'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { Icon } from './Icon'

type Props = { empresaId: string; hiloId?: string; documentoId?: string; categoriaId?: string; asunto?: string }

const MAX = 50 * 1024 * 1024
const error = async (res: Response, def: string) => (await res.json().catch(() => null))?.errors?.[0]?.message ?? def

/** Mensaje a CMC (o respuesta de CMC) con adjuntos. Los mensajes no se pueden editar ni borrar. */
export function MensajeForm({ empresaId, hiloId, documentoId, categoriaId, asunto }: Props) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [ficheros, setFicheros] = useState<File[]>([])
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
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
          body: JSON.stringify({ empresa: Number(empresaId), asunto: String(datos.get('asunto') ?? asunto ?? '').trim(), documento: documentoId ? Number(documentoId) : undefined, categoria: categoriaId ? Number(categoriaId) : undefined }),
        })
        if (!res.ok) throw new Error(await error(res, 'No se ha podido crear la conversación.'))
        hilo = String((await res.json()).doc.id)
      }
      const res = await fetch('/api/mensajes', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hilo: Number(hilo), texto, adjuntos }) })
      if (!res.ok) throw new Error(await error(res, 'No se ha podido enviar el mensaje.'))
      form.reset()
      setFicheros([])
      if (hiloId) router.refresh()
      else router.push(`/portal/mensajes/${hilo}`)
    } catch (err) {
      setFallo((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form className="stack" onSubmit={enviar}>
      {!hiloId && (
        <div className="field">
          <label htmlFor="asunto">Asunto</label>
          <input id="asunto" name="asunto" required defaultValue={asunto} maxLength={200} />
        </div>
      )}
      <div className="field">
        <label htmlFor="texto">{hiloId ? 'Respuesta' : 'Mensaje'}</label>
        <textarea id="texto" name="texto" rows={4} required maxLength={10000} />
      </div>
      <div className="row">
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => input.current?.click()}><Icon name="paperclip" />Adjuntar archivos</button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".pdf,image/*,.heic,.heif,.doc,.docx,.xls,.xlsx"
          onChange={(e) => setFicheros((p) => [...p, ...Array.from(e.target.files ?? []).filter((f) => f.size <= MAX)])}
        />
        {ficheros.map((f, i) => (
          <span key={i} className="tag">
            {f.name} <button type="button" className="enlace" aria-label={`Quitar ${f.name}`} onClick={() => setFicheros((p) => p.filter((_, j) => j !== i))}>×</button>
          </span>
        ))}
      </div>
      {fallo && <p role="alert" className="alert alert--error">{fallo}</p>}
      <div><button className="btn btn--primary" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar'}</button></div>
    </form>
  )
}
