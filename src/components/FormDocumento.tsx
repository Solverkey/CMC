import Link from 'next/link'
import { FormAccion } from './FormAccion'
import { guardarDocumento } from '@/app/(frontend)/portal/acciones'

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

const vacio: Valores = { titulo: '', categoria: '', referencia: '', organismo: '', fechaEmision: '', fechaCaducidad: '', fechaAviso: '', estadoManual: '', motivoEstado: '', limiteSubsanacion: '', gestion: '', observaciones: '' }

export function FormDocumento({ id, empresaId, empresaNombre, categorias, valores = vacio }: { id?: string; empresaId: string; empresaNombre: string; categorias: { id: string; nombre: string }[]; valores?: Valores }) {
  return (
    <>
      <Link href={id ? `/portal/documentos/${id}` : `/portal?empresa=${empresaId}`} className="small">← Volver</Link>
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{empresaNombre}</p>
        <h1>{id ? 'Editar documento' : 'Nuevo documento'}</h1>
      </div>
      <FormAccion accion={guardarDocumento} className="card stack" style={{ maxWidth: 760, gap: 16 }}>
        {id && <input type="hidden" name="id" value={id} />}
        <input type="hidden" name="empresa" value={empresaId} />
        <div className="field"><label htmlFor="titulo">Título</label><input className="input" id="titulo" name="titulo" required defaultValue={valores.titulo} /></div>
        <div className="field">
          <label htmlFor="categoria">Categoría</label>
          <select className="input" id="categoria" name="categoria" required defaultValue={valores.categoria}>
            <option value="">Elegir</option>
            {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="row">
          <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor="referencia">Referencia</label><input className="input" id="referencia" name="referencia" defaultValue={valores.referencia} /></div>
          <div className="field" style={{ flex: '1 1 240px' }}><label htmlFor="organismo">Organismo emisor</label><input className="input" id="organismo" name="organismo" defaultValue={valores.organismo} /></div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: '1 1 160px' }}><label htmlFor="fechaEmision">Emisión</label><input className="input" id="fechaEmision" name="fechaEmision" type="date" defaultValue={valores.fechaEmision} /></div>
          <div className="field" style={{ flex: '1 1 160px' }}><label htmlFor="fechaCaducidad">Caducidad</label><input className="input" id="fechaCaducidad" name="fechaCaducidad" type="date" defaultValue={valores.fechaCaducidad} /></div>
          <div className="field" style={{ flex: '1 1 160px' }}><label htmlFor="fechaAviso">Aviso</label><input className="input" id="fechaAviso" name="fechaAviso" type="date" defaultValue={valores.fechaAviso} /></div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: '1 1 240px' }}>
            <label htmlFor="estadoManual">Estado manual</label>
            <select className="input" id="estadoManual" name="estadoManual" defaultValue={valores.estadoManual}>
              <option value="">Automático</option>
              <option value="naranja">Naranja · Condicionada</option>
              <option value="rojo">Rojo · Revocada</option>
              <option value="azul">Azul · Pasado o archivado</option>
              <option value="negro">Negro · No legalizado</option>
            </select>
          </div>
          <div className="field" style={{ flex: '1 1 200px' }}>
            <label htmlFor="gestion">Gestión</label>
            <select className="input" id="gestion" name="gestion" defaultValue={valores.gestion}>
              <option value="">Heredar</option>
              <option value="gestionado">Gestionado por CMC</option>
              <option value="no_gestionado">No gestionado</option>
            </select>
          </div>
        </div>
        <div className="field"><label htmlFor="motivoEstado">Motivo del estado manual</label><textarea className="input" id="motivoEstado" name="motivoEstado" rows={2} defaultValue={valores.motivoEstado} /></div>
        <div className="field"><label htmlFor="limiteSubsanacion">Límite de subsanación</label><input className="input" id="limiteSubsanacion" name="limiteSubsanacion" type="date" defaultValue={valores.limiteSubsanacion} /></div>
        <div className="field"><label htmlFor="observaciones">Observaciones</label><textarea className="input" id="observaciones" name="observaciones" rows={3} defaultValue={valores.observaciones} /></div>
        <button className="btn btn--primary" type="submit">Guardar</button>
      </FormAccion>
    </>
  )
}
