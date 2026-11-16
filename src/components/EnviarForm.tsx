'use client'
import { useRef, useState } from 'react'
import { Icon } from './Icon'

type Props = { empresaId: string; documentoId?: string; tituloPorDefecto?: string }
type Item = { file: File; estado: 'pendiente' | 'subiendo' | 'ok' | 'error'; msg?: string }

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.round(n / 1024)} KB`)
const MAX = 50 * 1024 * 1024

/** Envío de documentos a la bandeja de revisión de CMC (RF-25) con subida múltiple (RF-08). */
export function EnviarForm({ empresaId, documentoId, tituloPorDefecto }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [activa, setActiva] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const añadir = (files: FileList | null) => {
    if (!files) return
    setItems((prev) => [
      ...prev,
      ...Array.from(files).map<Item>((f) => (f.size > MAX ? { file: f, estado: 'error', msg: 'Supera 50 MB' } : { file: f, estado: 'pendiente' })),
    ])
  }

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setEnviando(true)
    for (let i = 0; i < items.length; i++) {
      if (items[i].estado !== 'pendiente') continue
      setItems((p) => p.map((it, j) => (j === i ? { ...it, estado: 'subiendo' } : it)))
      const body = new FormData()
      body.append('file', items[i].file)
      body.append(
        '_payload',
        JSON.stringify({
          titulo: form.get('titulo') || items[i].file.name,
          empresa: empresaId,
          documentoRelacionado: documentoId,
          relacion: form.get('relacion') || 'Renovación',
          nuevaCaducidad: form.get('caducidad') || undefined,
          comentario: form.get('comentario') || undefined,
        }),
      )
      const res = await fetch('/api/envios', { method: 'POST', body, credentials: 'include' })
      const ok = res.ok
      const msg = ok ? 'Enviado a CMC para revisión' : ((await res.json().catch(() => null))?.errors?.[0]?.message ?? 'Error al enviar')
      setItems((p) => p.map((it, j) => (j === i ? { ...it, estado: ok ? 'ok' : 'error', msg } : it)))
    }
    setEnviando(false)
  }

  return (
    <form className="stack" onSubmit={enviar}>
      <div className="row" style={{ gap: 16, alignItems: 'stretch' }}>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label htmlFor="titulo">Nombre del documento</label>
          <input id="titulo" name="titulo" defaultValue={tituloPorDefecto} placeholder="Ej.: Inspección OCA baja tensión" />
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label htmlFor="relacion">Tipo de relación</label>
          <input id="relacion" name="relacion" list="relaciones" defaultValue={documentoId ? 'Renovación' : 'Original'} />
          <datalist id="relaciones"><option value="Original" /><option value="Renovación" /><option value="Subsanación" /><option value="Anexo" /><option value="Actualización" /></datalist>
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label htmlFor="caducidad">Nueva caducidad</label>
          <input id="caducidad" name="caducidad" type="date" />
          <span className="hint">CMC la revisa antes de publicar.</span>
        </div>
      </div>
      <div className="field"><label htmlFor="comentario">Comentario para CMC</label><textarea id="comentario" name="comentario" rows={2} /></div>

      <div
        className={`drop${activa ? ' drop--active' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.current?.click())}
        onDragOver={(e) => { e.preventDefault(); setActiva(true) }}
        onDragLeave={() => setActiva(false)}
        onDrop={(e) => { e.preventDefault(); setActiva(false); añadir(e.dataTransfer.files) }}
      >
        <span style={{ color: 'var(--slate)' }}><Icon name="upload" size={32} /></span>
        <strong>Arrastre aquí sus documentos</strong>
        <span>o <u>selecciónelos en su equipo</u> · PDF, imágenes u Office, hasta 50 MB</span>
        <input ref={input} type="file" multiple hidden accept=".pdf,image/*,.doc,.docx,.xls,.xlsx" onChange={(e) => añadir(e.target.files)} />
      </div>

      {items.map((it, i) => (
        <div key={i} className="file">
          <Icon name="file" />
          <span className="file__name">{it.file.name}</span>
          <span className="muted">{kb(it.file.size)}</span>
          {it.estado === 'subiendo' && <span className="muted">Subiendo…</span>}
          {it.estado === 'ok' && <span className="status status--verde">{it.msg}</span>}
          {it.estado === 'error' && <span className="status status--rojo">{it.msg}</span>}
        </div>
      ))}

      <div><button className="btn btn--primary" type="submit" disabled={enviando || !items.some((i) => i.estado === 'pendiente')}>{enviando ? 'Enviando…' : 'Enviar a revisión'}</button></div>
    </form>
  )
}
