'use client'
import { useActionState, useRef } from 'react'
import { gestionarHilo } from '@/app/(frontend)/portal/acciones'
import { Icon } from '../Icon'

type Props = { hilo: string; estado: 'abierto' | 'resuelto'; asignado: string; tecnicos: { id: number; nombre: string }[] }

/** CMC: asigna la conversación y la marca como resuelta o la reabre, sin salir de ella. */
export function GestionConversacion({ hilo, estado, asignado, tecnicos }: Props) {
  const [resAsignar, asignar, asignando] = useActionState(gestionarHilo, null)
  const [resEstado, cambiarEstado, cambiando] = useActionState(gestionarHilo, null)
  const form = useRef<HTMLFormElement>(null)
  const error = resAsignar?.error ?? resEstado?.error
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
