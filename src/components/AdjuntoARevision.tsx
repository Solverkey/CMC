'use client'
import { useState } from 'react'

/** Un adjunto recibido se puede mandar a la bandeja de revisión de CMC como documento. */
export function AdjuntoARevision({ adjunto, documento }: { adjunto: string; documento?: string }) {
  const [estado, setEstado] = useState<string | null>(null)
  return estado ? (
    <span className="small muted" role="status">{estado}</span>
  ) : (
    <button
      type="button"
      className="enlace small"
      onClick={async () => {
        const res = await fetch(`/api/adjuntos/${adjunto}/enviar-a-revision`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documento }) })
        setEstado(res.ok ? 'Enviado a la bandeja de revisión' : ((await res.json().catch(() => null))?.errors?.[0]?.message ?? 'No se ha podido enviar'))
      }}
    >
      Enviar a revisión como documento
    </button>
  )
}
