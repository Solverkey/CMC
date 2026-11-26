'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { altaEmpresa } from '@/app/(frontend)/portal/acciones'
import { FormAccion } from './FormAccion'
import { Icon } from './Icon'

/** El alta se abre sobre el panel. No cambia de página. */
export function AltaEmpresa() {
  const dialogo = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [turno, setTurno] = useState(0)
  const cerrar = useCallback(() => {
    dialogo.current?.close()
    router.refresh()
  }, [router])

  return (
    <>
      <button className="btn btn--primary" type="button" onClick={() => { setTurno((n) => n + 1); dialogo.current?.showModal() }}>
        <Icon name="building" />Alta de empresa
      </button>
      <dialog
        ref={dialogo}
        className="dialogo"
        aria-labelledby="alta-titulo"
        onClick={(e) => { if (e.target === dialogo.current) dialogo.current?.close() }}
      >
        <div className="dialogo__caja stack" style={{ gap: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div className="stack" style={{ gap: 4 }}>
              <h2 id="alta-titulo" style={{ margin: 0 }}>Alta de empresa</h2>
              <p className="muted" style={{ margin: 0 }}>Se crean las instalaciones estándar y se invita al administrador por correo.</p>
            </div>
            <button className="btn btn--secondary btn--sm" type="button" onClick={() => dialogo.current?.close()}>Cerrar</button>
          </div>
          <FormAccion key={turno} accion={altaEmpresa} alTerminar={cerrar} className="stack" style={{ gap: 16 }}>
            <div className="field"><label htmlFor="razonSocial">Razón social</label><input className="input" id="razonSocial" name="razonSocial" required /></div>
            <div className="field"><label htmlFor="cif">CIF</label><input className="input" id="cif" name="cif" required /></div>
            <div className="row">
              <div className="field" style={{ flex: '1 1 240px' }}><label htmlFor="direccion">Dirección</label><input className="input" id="direccion" name="direccion" /></div>
              <div className="field" style={{ flex: '1 1 180px' }}><label htmlFor="sector">Sector</label><input className="input" id="sector" name="sector" /></div>
            </div>
            <div className="field"><label htmlFor="contacto">Contacto principal</label><input className="input" id="contacto" name="contacto" /></div>
            <div className="field"><label htmlFor="emails">Emails de aviso</label><input className="input" id="emails" name="emails" placeholder="Separados por comas" /></div>
            <div className="field">
              <label htmlFor="gestion">Modalidad</label>
              <select className="input" id="gestion" name="gestion" defaultValue="">
                <option value="">Sin indicar (no gestionado)</option>
                <option value="gestionado">Gestionado por CMC</option>
                <option value="no_gestionado">No gestionado</option>
              </select>
            </div>
            <div className="row">
              <div className="field" style={{ flex: '1 1 240px' }}><label htmlFor="adminEmail">Email del administrador</label><input className="input" id="adminEmail" name="adminEmail" type="email" required /></div>
              <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="adminNombre">Nombre</label><input className="input" id="adminNombre" name="adminNombre" /></div>
            </div>
            <label className="row"><input type="checkbox" name="aplicarPlantilla" defaultChecked /> Crear las instalaciones estándar</label>
            <button className="btn btn--primary" type="submit">Crear empresa</button>
          </FormAccion>
        </div>
      </dialog>
    </>
  )
}
