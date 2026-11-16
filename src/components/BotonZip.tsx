'use client'
import { useState } from 'react'
import { Icon } from './Icon'

/** Descarga en un ZIP los documentos marcados en el formulario indicado (RF-09). */
export function BotonZip({ formId }: { formId: string }) {
  const [estado, setEstado] = useState<string | null>(null)

  async function descargar() {
    const form = document.getElementById(formId) as HTMLFormElement | null
    if (!form) return
    const datos = new FormData(form)
    const ids = datos.getAll('ids').map(String)
    if (!ids.length) return setEstado('Marque al menos un documento.')
    setEstado('Preparando el ZIP…')
    const res = await fetch('/api/zip', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, historico: datos.get('historico') === 'on' }) })
    if (!res.ok) return setEstado((await res.json().catch(() => null))?.errors?.[0]?.message ?? 'No se ha podido generar el ZIP.')
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = url
    a.download = `Documentos ${new Date().toISOString().slice(0, 10)}.zip`
    a.click()
    URL.revokeObjectURL(url)
    setEstado(null)
  }

  return (
    <span className="row">
      <label className="small row" style={{ gap: 6 }}><input type="checkbox" name="historico" form={formId} />Incluir histórico</label>
      <button type="button" className="btn btn--secondary btn--sm" onClick={descargar}><Icon name="download" />Descargar seleccionados (ZIP)</button>
      {estado && <span className="small muted" role="status">{estado}</span>}
    </span>
  )
}

export function MarcarTodos({ formId }: { formId: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Marcar todos"
      onChange={(e) => document.querySelectorAll<HTMLInputElement>(`#${formId} input[name=ids]`).forEach((c) => (c.checked = e.target.checked))}
    />
  )
}
