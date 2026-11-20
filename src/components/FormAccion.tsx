'use client'
import { useActionState, useEffect } from 'react'
import type { Resultado } from '@/app/(frontend)/portal/acciones'

type Props = {
  accion: (prev: Resultado, f: FormData) => Promise<Resultado>
  children: React.ReactNode
  confirmar?: string
  className?: string
  style?: React.CSSProperties
  alTerminar?: () => void
}

/** Formulario ligado a una acción del servidor, con confirmación opcional y mensaje de resultado. */
export function FormAccion({ accion, children, confirmar, className, style, alTerminar }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, null)
  useEffect(() => {
    if (estado?.ok) alTerminar?.()
  }, [estado, alTerminar])
  return (
    <form
      action={enviar}
      className={className}
      style={style}
      aria-busy={pendiente}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault()
      }}
    >
      {children}
      {estado?.error && <p role="alert" className="alert alert--error">{estado.error}</p>}
      {estado?.ok && <p role="status" className="alert alert--ok">{estado.ok}</p>}
      {estado?.clave && (
        <code className="clave" onClick={(e) => navigator.clipboard?.writeText((e.target as HTMLElement).textContent ?? '')}>
          {estado.clave}
        </code>
      )}
    </form>
  )
}
