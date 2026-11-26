'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EnviarForm } from './EnviarForm'
import { Icon } from './Icon'

type Props = {
  empresaId: string
  empresaNombre: string
  categorias: { id: string; nombre: string }[]
  /** Desde la ficha: el envío es una renovación o un anexo de este documento. */
  documentoId?: string
  documentoTitulo?: string
  etiqueta?: string
  clase?: string
  /** Se abre solo al cargar (al venir de elegir la empresa). */
  abrirAlCargar?: boolean
}

/** El envío a CMC se abre sobre la página (Documentos o la ficha). No cambia de página. */
export function EnviarCmc({ empresaId, empresaNombre, categorias, documentoId, documentoTitulo, etiqueta = 'Enviar a CMC', clase = 'btn btn--primary', abrirAlCargar = false }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [turno, setTurno] = useState(0)
  const cerrar = useCallback(() => dialogo.current?.close(), [])
  useEffect(() => {
    if (abrirAlCargar && !dialogo.current?.open) dialogo.current?.showModal()
  }, [abrirAlCargar])

  return (
    <>
      <button className={clase} type="button" onClick={() => { setTurno((n) => n + 1); dialogo.current?.showModal() }}>
        <Icon name="upload" />{etiqueta}
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
              <h2 id="enviar-cmc-titulo" style={{ margin: 0 }}>{documentoTitulo ? 'Enviar archivo de este documento' : 'Enviar a CMC'}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {documentoTitulo ? <>«{documentoTitulo}» · {empresaNombre}. Renovación, subsanación o anexo: CMC lo revisa y lo publica en esta ficha.</> : <>{empresaNombre}. CMC revisa el envío, completa la instalación y las fechas, y lo publica.</>} Le avisaremos por correo.
              </p>
            </div>
            <button className="dialogo__cerrar" type="button" onClick={cerrar} aria-label="Cerrar"><Icon name="close" size={16} /></button>
          </div>
          <EnviarForm key={turno} empresaId={empresaId} categorias={categorias} documentoId={documentoId} tituloPorDefecto={documentoTitulo} alEnviar={() => router.refresh()} />
        </div>
      </dialog>
    </>
  )
}
