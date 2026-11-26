'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EnviarForm } from './EnviarForm'
import { Icon } from './Icon'

/** El envío a CMC se abre sobre Documentos. No cambia de página. */
export function EnviarCmc({ empresaId, empresaNombre, categorias }: { empresaId: string; empresaNombre: string; categorias: { id: string; nombre: string }[] }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [turno, setTurno] = useState(0)
  const cerrar = useCallback(() => dialogo.current?.close(), [])

  return (
    <>
      <button className="btn btn--primary" type="button" onClick={() => { setTurno((n) => n + 1); dialogo.current?.showModal() }}>
        <Icon name="upload" />Enviar a CMC
      </button>
      <dialog
        ref={dialogo}
        className="dialogo"
        aria-labelledby="enviar-cmc-titulo"
        onClick={(e) => { if (e.target === dialogo.current) dialogo.current?.close() }}
      >
        <div className="dialogo__caja stack" style={{ gap: 16 }}>
          <div className="dialogo__cabeza">
            <div className="stack" style={{ gap: 4 }}>
              <h2 id="enviar-cmc-titulo" style={{ margin: 0 }}>Enviar a CMC</h2>
              <p className="muted" style={{ margin: 0 }}>{empresaNombre}. CMC revisa el envío, completa la instalación y las fechas, y lo publica. Le avisaremos por correo.</p>
            </div>
            <button className="dialogo__cerrar" type="button" onClick={cerrar} aria-label="Cerrar"><Icon name="close" size={16} /></button>
          </div>
          <EnviarForm key={turno} empresaId={empresaId} categorias={categorias} alEnviar={() => router.refresh()} />
        </div>
      </dialog>
    </>
  )
}
