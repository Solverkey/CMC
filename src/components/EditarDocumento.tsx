'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { guardarDocumento } from '@/app/(frontend)/portal/acciones'
import { FormAccion } from './FormAccion'
import { Icon } from './Icon'
import { SelectorCatalogo, SelectorInstalacion } from './Selectores'

type Valores = {
  titulo: string
  categoria: string
  referencia: string
  organismo: string
  fechaEmision: string
  fechaCaducidad: string
  fechaAviso: string
  estadoManual: string
  motivoEstado: string
  limiteSubsanacion: string
  gestion: string
  observaciones: string
}

/** La edición se abre sobre la ficha. No cambia de página. */
export function EditarDocumento({ id, empresaId, categorias, valores }: { id: string; empresaId: string; categorias: { id: string; nombre: string }[]; valores: Valores }) {
  const dialogo = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [turno, setTurno] = useState(0)
  const cerrar = useCallback(() => {
    dialogo.current?.close()
    router.refresh()
  }, [router])

  return (
    <>
      <button className="btn btn--secondary" type="button" onClick={() => { setTurno((n) => n + 1); dialogo.current?.showModal() }}>
        <Icon name="settings" />Editar
      </button>
      <dialog ref={dialogo} className="dialogo" aria-labelledby="editar-titulo" onClick={(e) => { if (e.target === dialogo.current) dialogo.current?.close() }}>
        <div className="dialogo__caja stack" style={{ gap: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 id="editar-titulo" style={{ margin: 0 }}>Editar documento</h2>
            <button className="btn btn--secondary btn--sm" type="button" onClick={() => dialogo.current?.close()}>Cerrar</button>
          </div>
          <FormAccion key={turno} accion={guardarDocumento} alTerminar={cerrar} className="stack" style={{ gap: 16 }}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="empresa" value={empresaId} />
            <div className="field">
              <label htmlFor="ed-titulo">Título</label>
              <SelectorCatalogo tipo="documento" etiqueta="Título" id="ed-titulo" name="titulo" required valor={valores.titulo} />
            </div>
            <div className="field">
              <label htmlFor="ed-categoria">Instalación</label>
              <SelectorInstalacion id="ed-categoria" name="categoria" required empresaId={empresaId} instalaciones={categorias} valor={valores.categoria} />
            </div>
            <div className="row">
              <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="ed-referencia">Referencia</label><input className="input" id="ed-referencia" name="referencia" defaultValue={valores.referencia} /></div>
              <div className="field" style={{ flex: '1 1 220px' }}><label htmlFor="ed-organismo">Organismo emisor</label><input className="input" id="ed-organismo" name="organismo" defaultValue={valores.organismo} /></div>
            </div>
            <div className="row">
              <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="ed-emision">Emisión</label><input className="input" id="ed-emision" name="fechaEmision" type="date" defaultValue={valores.fechaEmision} /></div>
              <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="ed-caducidad">Caducidad</label><input className="input" id="ed-caducidad" name="fechaCaducidad" type="date" defaultValue={valores.fechaCaducidad} /></div>
              <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="ed-aviso">Aviso</label><input className="input" id="ed-aviso" name="fechaAviso" type="date" defaultValue={valores.fechaAviso} /></div>
            </div>
            <div className="field">
              <label htmlFor="ed-meses">Antelación propia (meses)</label>
              <input className="input" id="ed-meses" name="antelacionMeses" type="number" min={0} placeholder="Usa el estándar del cliente o de la instalación" />
              <span className="hint">Si lo rellena, esta caducidad avisa con esos meses. Vacío = el estándar.</span>
            </div>
            <div className="row">
              <div className="field" style={{ flex: '1 1 220px' }}>
                <label htmlFor="ed-estado">Estado manual</label>
                <select className="input" id="ed-estado" name="estadoManual" defaultValue={valores.estadoManual}>
                  <option value="">Automático</option>
                  <option value="naranja">Naranja · Condicionada</option>
                  <option value="rojo">Rojo · Revocada</option>
                  <option value="azul">Azul · Pasado o archivado</option>
                  <option value="negro">Negro · No legalizado</option>
                </select>
              </div>
              <div className="field" style={{ flex: '1 1 180px' }}>
                <label htmlFor="ed-gestion">Gestión</label>
                <select className="input" id="ed-gestion" name="gestion" defaultValue={valores.gestion}>
                  <option value="">Heredar</option>
                  <option value="gestionado">Gestionado por CMC</option>
                  <option value="no_gestionado">No gestionado</option>
                </select>
              </div>
            </div>
            <div className="field"><label htmlFor="ed-motivo">Motivo del estado manual</label><textarea className="input" id="ed-motivo" name="motivoEstado" rows={2} defaultValue={valores.motivoEstado} /></div>
            <div className="field"><label htmlFor="ed-subsanacion">Límite de subsanación</label><input className="input" id="ed-subsanacion" name="limiteSubsanacion" type="date" defaultValue={valores.limiteSubsanacion} /></div>
            <div className="field"><label htmlFor="ed-obs">Observaciones</label><textarea className="input" id="ed-obs" name="observaciones" rows={3} defaultValue={valores.observaciones} /></div>
            <button className="btn btn--primary" type="submit">Guardar</button>
          </FormAccion>
        </div>
      </dialog>
    </>
  )
}
