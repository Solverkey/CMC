'use client'
import { useRef, useState } from 'react'
import { Combobox } from './Combobox'
import { Icon } from './Icon'

type Props = { empresaId: string; documentoId?: string; tituloPorDefecto?: string; categoriaId?: string; categorias?: { id: string; nombre: string }[] }
type Item = { file: File; estado: 'pendiente' | 'subiendo' | 'ok' | 'error'; msg?: string }

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.round(n / 1024)} KB`)
const MAX = 50 * 1024 * 1024

/** Envío de documentos a la bandeja de revisión de CMC (RF-25) con subida múltiple (RF-08). */
export function EnviarForm({ empresaId, documentoId, tituloPorDefecto, categoriaId, categorias = [] }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [activa, setActiva] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [categoria, setCategoria] = useState(categoriaId ?? '')

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
      const json = await res.json().catch(() => null)
      const doc = json?.doc as { filesize?: number; tamanoOriginal?: number } | undefined
      const comprimido = ok && doc?.filesize && doc.tamanoOriginal && doc.filesize < doc.tamanoOriginal ? ` · optimizada de ${kb(doc.tamanoOriginal)} a ${kb(doc.filesize)}` : ''
      const msg = ok ? `Enviado a CMC para revisión${comprimido}` : (json?.errors?.[0]?.message ?? 'Error al enviar')
      setItems((p) => p.map((it, j) => (j === i ? { ...it, estado: ok ? 'ok' : 'error', msg } : it)))
    }
    setEnviando(false)
  }

  return (
    <form className="stack" onSubmit={enviar}>
      <div className="row" style={{ gap: 16, alignItems: 'stretch' }}>
        <div className="field" style={{ flex: '1 1 220px' }}>
          <label htmlFor="titulo">Nombre del documento</label>
          <Combobox tipo="documento" id="titulo" name="titulo" defaultValue={tituloPorDefecto} placeholder="Ej.: Inspección de baja tensión" categoria={categoria || undefined} />
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label htmlFor="relacion">Tipo de relación</label>
          <Combobox tipo="relacion" id="relacion" name="relacion" defaultValue={documentoId ? 'Renovación' : 'Original'} />
        </div>
        <div className="field" style={{ flex: '1 1 180px' }}>
          <label htmlFor="caducidad">Nueva caducidad</label>
          <input id="caducidad" name="caducidad" type="date" />
          <span className="hint">CMC la revisa antes de publicar.</span>
        </div>
      </div>
      {!categoriaId && categorias.length > 0 && (
        <div className="field">
          <label htmlFor="categoria-nombre">Categoría</label>
          <select id="categoria-nombre" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">Sin indicar</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <span className="hint">Si la indica, el nombre prioriza los ya usados en esa categoría. CMC la confirma al publicar.</span>
        </div>
      )}
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
        <strong>Arrastre aquí uno o varios documentos</strong>
        <span>o <u>selecciónelos en su equipo</u> · puede elegir varios a la vez · PDF, fotos (también del móvil) u Office, hasta 50 MB cada uno</span>
        <input ref={input} type="file" multiple hidden accept=".pdf,image/*,.heic,.heif,.doc,.docx,.xls,.xlsx" onChange={(e) => { añadir(e.target.files); e.target.value = '' }} />
      </div>

      {items.map((it, i) => (
        <div key={i} className="file">
          <Icon name="file" />
          <span className="file__name">{it.file.name}</span>
          <span className="muted">{kb(it.file.size)}</span>
          {it.estado === 'subiendo' && <span className="muted">Subiendo…</span>}
          {it.estado === 'ok' && <span className="status status--verde">{it.msg}</span>}
          {it.estado === 'error' && <span className="status status--rojo">{it.msg}</span>}
          {it.estado === 'pendiente' && (
            <button type="button" className="enlace" aria-label={`Quitar ${it.file.name}`} onClick={() => setItems((p) => p.filter((_, j) => j !== i))}>
              Quitar
            </button>
          )}
        </div>
      ))}

      <div><button className="btn btn--primary" type="submit" disabled={enviando || !items.some((i) => i.estado === 'pendiente')}>{enviando ? 'Enviando…' : 'Enviar a revisión'}</button></div>
    </form>
  )
}
