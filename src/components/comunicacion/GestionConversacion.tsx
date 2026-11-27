'use client'
import { startTransition, useActionState, useRef } from 'react'
import { gestionarHilo, vincularDocumentoHilo } from '@/app/(frontend)/portal/acciones'
import { Desplegable } from '../Desplegable'
import { Icon } from '../Icon'

type Props = {
  hilo: string
  estado: 'abierto' | 'resuelto'
  asignado: string
  tecnicos: { id: number; nombre: string }[]
  /** Documentos de la empresa, para vincular la conversación a uno (sus adjuntos irán a ese documento). */
  documentos: { id: string; titulo: string }[]
  documento: string
}

/** CMC: asigna la conversación y la marca como resuelta o la reabre, sin salir de ella. */
export function GestionConversacion({ hilo, estado, asignado, tecnicos, documentos, documento }: Props) {
  const [resAsignar, asignar, asignando] = useActionState(gestionarHilo, null)
  const [resEstado, cambiarEstado, cambiando] = useActionState(gestionarHilo, null)
  const [resDoc, vincular, vinculando] = useActionState(vincularDocumentoHilo, null)
  const form = useRef<HTMLFormElement>(null)
  const error = resAsignar?.error ?? resEstado?.error ?? resDoc?.error
  return (
    <div className="conv__gestion">
      <form ref={form} action={asignar} aria-busy={asignando}>
        <input type="hidden" name="hilo" value={hilo} />
        <label htmlFor="asignado" className="muted">Asignada a</label>
        <select id="asignado" name="asignado" className="input" defaultValue={asignado} onChange={() => form.current?.requestSubmit()} disabled={asignando}>
          <option value="">Sin asignar</option>
          {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </form>
      <div className="conv__gestion__doc" aria-busy={vinculando}>
        <span className="muted">Documento</span>
        <Desplegable
          etiqueta="Documento de la conversación"
          vacia="Sin documento"
          opciones={documentos.map((d) => ({ valor: d.id, texto: d.titulo }))}
          valor={documento}
          alCambiar={(v) => {
            const f = new FormData()
            f.set('hilo', hilo)
            f.set('documento', v)
            startTransition(() => vincular(f))
          }}
        />
      </div>
      <form action={cambiarEstado} aria-busy={cambiando} style={{ marginLeft: 'auto' }}>
        <input type="hidden" name="hilo" value={hilo} />
        <input type="hidden" name="estado" value={estado === 'resuelto' ? 'abierto' : 'resuelto'} />
        <button className="btn btn--secondary btn--sm" disabled={cambiando}>
          <Icon name={estado === 'resuelto' ? 'chat' : 'check'} />
          {estado === 'resuelto' ? 'Reabrir' : 'Marcar como resuelta'}
        </button>
      </form>
      {error && <p role="alert" className="alert alert--error">{error}</p>}
    </div>
  )
}
