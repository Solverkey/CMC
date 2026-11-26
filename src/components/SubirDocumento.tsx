'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './Icon'

type Categoria = { id: string; nombre: string }

/** Subida de CMC. Sin documento, el archivo crea el documento. Con documento, se añade al histórico. */
export function SubirDocumento({ empresaId, categorias = [], documentos = [], documentoId, meses, variante = 'dialogo' }: { empresaId: string; categorias?: Categoria[]; documentos?: { id: string; titulo: string }[]; documentoId?: string; meses?: number; variante?: 'dialogo' | 'ficha' }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const anadir = Boolean(documentoId)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    const res = await fetch('/portal/subir', { method: 'POST', body: new FormData(e.currentTarget), credentials: 'include' })
    const json = await res.json().catch(() => null)
    setEnviando(false)
    if (!res.ok) {
      setError(json?.error || 'No se ha podido subir el archivo.')
      return
    }
    dialogo.current?.close()
    router.push(`/portal/documentos/${json.id}`)
    router.refresh()
  }

  const campos = (
    <>
      <input type="hidden" name="empresa" value={empresaId} />
      {documentoId && <input type="hidden" name="documento" value={documentoId} />}
      <div className="field">
        <label htmlFor={anadir ? 'archivo-ficha' : 'archivo'}>Archivo</label>
        <input className="input" id={anadir ? 'archivo-ficha' : 'archivo'} name="file" type="file" required />
      </div>
      {!anadir && documentos.length > 0 && (
        <div className="field">
          <label htmlFor="documento-subida">Asociar a un documento existente</label>
          <select className="input" id="documento-subida" name="documento" defaultValue="">
            <option value="">Crear el documento con este archivo</option>
            {documentos.map((d) => <option key={d.id} value={d.id}>{d.titulo}</option>)}
          </select>
        </div>
      )}
      {!anadir && (
        <>
          <div className="field"><label htmlFor="titulo-subida">Nombre</label><input className="input" id="titulo-subida" name="titulo" placeholder="Si se deja vacío, se usa el del archivo" /></div>
          <div className="field">
            <label htmlFor="categoria-subida">Instalación</label>
            <select className="input" id="categoria-subida" name="categoria" defaultValue="">
              <option value="">Elegir</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        </>
      )}
      {anadir && (
        <div className="field"><label htmlFor="relacion-subida">Tipo de relación</label><input className="input" id="relacion-subida" name="relacion" defaultValue="Renovación" /></div>
      )}
      <div className="row">
        {!anadir && <div className="field" style={{ flex: '1 1 160px' }}><label htmlFor="emision-subida">Emisión</label><input className="input" id="emision-subida" name="fechaEmision" type="date" /></div>}
        <div className="field" style={{ flex: '1 1 160px' }}><label htmlFor="caducidad-subida">Caducidad</label><input className="input" id="caducidad-subida" name="fechaCaducidad" type="date" /></div>
      </div>
      <div className="field">
        <label htmlFor="meses-subida">Avisar con (meses)</label>
        <input type="hidden" name="antelacionHeredada" value={meses ?? ''} />
        <input className="input" id="meses-subida" name="antelacionMeses" type="number" min={0} defaultValue={typeof meses === 'number' ? meses : ''} />
        <span className="hint">{typeof meses === 'number' ? `Estándar: ${meses} meses. Cámbielo si este archivo tiene que avisar antes o después.` : 'Sin estándar cargado.'}</span>
      </div>
      {error && <p role="alert" className="alert alert--error">{error}</p>}
      <button className="btn btn--primary" type="submit" disabled={enviando}>{enviando ? 'Subiendo…' : anadir ? 'Añadir archivo' : 'Subir documento'}</button>
    </>
  )

  if (variante === 'ficha') {
    return (
      <form className="stack" style={{ gap: 16 }} onSubmit={enviar}>
        {campos}
      </form>
    )
  }

  return (
    <>
      <button className="btn btn--primary" type="button" onClick={() => { setError(null); dialogo.current?.showModal() }}>
        <Icon name="upload" />Subir documento
      </button>
      <dialog ref={dialogo} className="dialogo" aria-labelledby="subir-titulo" onClick={(e) => { if (e.target === dialogo.current) dialogo.current?.close() }}>
        <form className="dialogo__caja stack" style={{ gap: 16 }} onSubmit={enviar}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stack" style={{ gap: 4 }}>
              <h2 id="subir-titulo" style={{ margin: 0 }}>Subir documento</h2>
              <p className="muted" style={{ margin: 0 }}>El documento entra con el archivo. No se crea uno vacío.</p>
            </div>
            <button className="btn btn--secondary btn--sm" type="button" onClick={() => dialogo.current?.close()}>Cerrar</button>
          </div>
          {campos}
        </form>
      </dialog>
    </>
  )
}
