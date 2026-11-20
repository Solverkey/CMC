import Link from 'next/link'
import { FormAccion } from '@/components/FormAccion'
import { altaEmpresa } from '@/app/(frontend)/portal/acciones'
import { contexto } from '@/lib/payload'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Alta de empresa' }

export default async function AltaEmpresa() {
  const { cmc } = await contexto('/portal/empresas/nueva')
  if (!cmc) redirect('/portal')

  return (
    <>
      <Link href="/portal" className="small">← Panel de empresas</Link>
      <div className="stack" style={{ gap: 4 }}>
        <h1>Alta de empresa</h1>
        <p className="muted">Se crean las categorías estándar y se invita al administrador por correo.</p>
      </div>
      <FormAccion accion={altaEmpresa} className="card stack" style={{ maxWidth: 720, gap: 16 }}>
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
        <label className="row"><input type="checkbox" name="aplicarPlantilla" defaultChecked /> Crear las categorías estándar</label>
        <button className="btn btn--primary" type="submit">Crear empresa</button>
      </FormAccion>
    </>
  )
}
