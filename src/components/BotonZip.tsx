'use client'
import { useEffect, useState } from 'react'
import { Icon } from './Icon'

const marcados = (formId: string) => Array.from(document.querySelectorAll<HTMLInputElement>(`#${formId} input[name=ids]:checked`))

/**
 * Barra de selección de la lista de documentos: aparece al marcar alguno, dice cuántos hay
 * y los descarga en un ZIP (RF-09), con o sin el histórico.
 */
export function BotonZip({ formId }: { formId: string }) {
  const [n, setN] = useState(0)
  const [estado, setEstado] = useState<string | null>(null)

  useEffect(() => {
    const form = document.getElementById(formId)
    if (!form) return
    const contar = () => setN(marcados(formId).length)
    form.addEventListener('change', contar)
    return () => form.removeEventListener('change', contar)
  }, [formId])

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

  function quitar() {
    document.querySelectorAll<HTMLInputElement>(`#${formId} input[type=checkbox]`).forEach((c) => {
      if (c.name !== 'historico') c.checked = false
    })
    setN(0)
    setEstado(null)
  }

  return (
    <div className="seleccion" hidden={n === 0} role="region" aria-label="Documentos seleccionados">
      <strong>{n} {n === 1 ? 'documento seleccionado' : 'documentos seleccionados'}</strong>
      <label className="small row" style={{ gap: 6 }}><input type="checkbox" name="historico" form={formId} />Incluir histórico</label>
      <button type="button" className="btn btn--primary btn--sm" onClick={descargar}><Icon name="download" />Descargar ZIP</button>
      <button type="button" className="btn btn--ghost btn--sm" onClick={quitar}>Quitar selección</button>
      {estado && <span className="small" role="status">{estado}</span>}
    </div>
  )
}

export function MarcarTodos({ formId }: { formId: string }) {
  return (
    <input
      type="checkbox"
      aria-label="Marcar todos"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(`#${formId} input[name=ids]`).forEach((c) => (c.checked = e.target.checked))
        document.getElementById(formId)?.dispatchEvent(new Event('change', { bubbles: true }))
      }}
    />
  )
}
