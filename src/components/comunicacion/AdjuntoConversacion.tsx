'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import { incorporarAdjunto } from '@/app/(frontend)/portal/acciones'
import type { DestinoAdjunto } from '@/datos/adjuntos'
import { Desplegable } from '../Desplegable'
import { FormAccion } from '../FormAccion'
import { Icon } from '../Icon'
import { SelectorCatalogo } from '../Selectores'
import { Enlace as Link } from '../Enlace'

type Props = {
  adjunto: { id: number; filename: string; url: string | null; tamano: string }
  destino?: DestinoAdjunto
  cmc: boolean
  /** Documentos de la empresa entre los que CMC puede elegir; el de la conversación va primero. */
  documentos?: { id: string; titulo: string }[]
  documentoConversacion?: string
  /** Enlace a la conversación (en la ficha del documento). */
  conversacion?: { id: number; asunto: string }
  compacto?: boolean
  /** Documento cuya ficha se está viendo: el estado dice «este documento» en vez de enlazarlo. */
  enDocumento?: string
}

/** Estado del adjunto: si ya está en un documento o enviado a revisión, se dice y se enlaza. */
function Estado({ destino, cmc, aqui }: { destino?: DestinoAdjunto; cmc: boolean; aqui?: string }) {
  if (destino?.archivo && String(destino.archivo.documentoId) === aqui)
    return <span className="adjunto__estado adjunto__estado--ok"><Icon name="check" size={14} />Añadido a este documento · {destino.archivo.relacion}</span>
  if (destino?.archivo)
    return (
      <span className="adjunto__estado adjunto__estado--ok">
        <Icon name="check" size={14} />En el documento <Link href={`/portal/documentos/${destino.archivo.documentoId}`}>{destino.archivo.documentoTitulo}</Link> · {destino.archivo.relacion}
      </span>
    )
  const e = destino?.envio
  if (!e) return null
  if (e.estado === 'publicado')
    return (
      <span className="adjunto__estado adjunto__estado--ok">
        <Icon name="check" size={14} />Publicado{e.documentoId ? <> en <Link href={`/portal/documentos/${e.documentoId}`}>{e.documentoTitulo}</Link></> : null}
      </span>
    )
  if (e.estado === 'rechazado') return <span className="adjunto__estado adjunto__estado--mal" title={e.motivoRechazo ?? undefined}>Envío rechazado{e.motivoRechazo ? `: ${e.motivoRechazo}` : ''}</span>
  return (
    <span className="adjunto__estado adjunto__estado--espera">
      <Icon name="clock" size={14} />Enviado a revisión{cmc ? <> · <Link href={`/portal/enviar/${e.id}`}>Revisar</Link></> : ' · CMC lo está revisando'}
    </span>
  )
}

export function AdjuntoConversacion({ adjunto, destino, cmc, documentos = [], documentoConversacion, conversacion, compacto, enDocumento }: Props) {
  const router = useRouter()
  const dialogo = useRef<HTMLDialogElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const yaIncorporado = Boolean(destino?.archivo)
  const enRevision = destino?.envio && destino.envio.estado !== 'rechazado'
  // La acción ya revalida la página; aquí solo se cierra el diálogo (estable, para no repetir el efecto).
  const cerrar = useCallback(() => dialogo.current?.close(), [])

  async function enviarARevision() {
    setEnviando(true)
    setFallo(null)
    const res = await fetch(`/api/adjuntos/${adjunto.id}/enviar-a-revision`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documento: documentoConversacion }) })
    setEnviando(false)
    if (!res.ok) return setFallo((await res.json().catch(() => null))?.errors?.[0]?.message ?? 'No se ha podido enviar.')
    router.refresh()
  }

  return (
    <div className={`adjunto${compacto ? ' adjunto--compacto' : ''}`}>
      <div className="adjunto__fila">
        <Icon name="paperclip" />
        <a className="adjunto__nombre" href={adjunto.url ?? '#'} target="_blank" rel="noreferrer">{adjunto.filename}</a>
        <span className="small muted">{adjunto.tamano}</span>
        {!cmc && !yaIncorporado && !enRevision && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={enviarARevision} disabled={enviando}>
            <Icon name="upload" />{enviando ? 'Enviando…' : documentoConversacion ? 'Enviar a CMC para este documento' : 'Enviar a CMC como documento'}
          </button>
        )}
        {cmc && !yaIncorporado && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => dialogo.current?.showModal()}>
            <Icon name="file" />Añadir a un documento
          </button>
        )}
      </div>
      {conversacion && <span className="small muted">En la conversación <Link href={`/portal/mensajes/${conversacion.id}`}>{conversacion.asunto}</Link></span>}
      <Estado destino={destino} cmc={cmc} aqui={enDocumento} />
      {fallo && <span role="alert" className="small error">{fallo}</span>}

      {cmc && !yaIncorporado && (
        <dialog ref={dialogo} className="dialogo" aria-labelledby={`incorporar-${adjunto.id}`} onClick={(e) => { if (e.target === dialogo.current) dialogo.current?.close() }}>
          <div className="dialogo__caja stack" style={{ gap: 16 }}>
            <div className="dialogo__cabeza">
              <div className="stack" style={{ gap: 4 }}>
                <h2 id={`incorporar-${adjunto.id}`} style={{ margin: 0 }}>Añadir a un documento</h2>
                <p className="muted" style={{ margin: 0 }}>«{adjunto.filename}» pasa a ser un archivo del documento. Si sustituye al vigente, el anterior queda en el histórico. En la conversación quedará constancia.</p>
              </div>
              <button className="dialogo__cerrar" type="button" onClick={() => dialogo.current?.close()} aria-label="Cerrar"><Icon name="close" size={16} /></button>
            </div>
            {documentos.length === 0 ? (
              <p className="muted">Esta empresa no tiene documentos. Créelo antes desde Documentos.</p>
            ) : (
              <FormAccion accion={incorporarAdjunto} className="stack" alTerminar={cerrar}>
                <input type="hidden" name="adjunto" value={adjunto.id} />
                <div className="field">
                  <label>Documento</label>
                  <Desplegable name="documento" etiqueta="Documento" opciones={documentos.map((d) => ({ valor: d.id, texto: d.titulo }))} valor={documentoConversacion ?? documentos[0].id} />
                </div>
                <div className="field">
                  <label htmlFor={`relacion-${adjunto.id}`}>Tipo de archivo</label>
                  <SelectorCatalogo tipo="relacion" etiqueta="Tipo de archivo" id={`relacion-${adjunto.id}`} name="relacion" valor="Renovación" />
                  <span className="hint">Renovación sustituye al vigente y actualiza las fechas; Anexo se añade sin cambiar nada; Subsanación puede levantar la condición.</span>
                </div>
                <div className="row">
                  <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor={`cad-${adjunto.id}`}>Nueva caducidad</label><input id={`cad-${adjunto.id}`} name="nuevaCaducidad" type="date" /></div>
                  <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor={`aviso-${adjunto.id}`}>Nueva fecha de aviso</label><input id={`aviso-${adjunto.id}`} name="nuevoAviso" type="date" /></div>
                </div>
                <span className="hint">Las fechas solo hacen falta si el tipo actualiza fechas (como Renovación). Sin aviso, se calcula con la antelación estándar.</span>
                <button className="btn btn--primary" type="submit">Añadir al documento</button>
              </FormAccion>
            )}
          </div>
        </dialog>
      )}
    </div>
  )
}
