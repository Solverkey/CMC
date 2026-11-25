import { notFound } from 'next/navigation'
import { invitar, quitar, reenviar, rol } from '../../acciones'
import { CambioRol } from '@/components/CambioRol'
import { EmpresaSelector } from '@/components/EmpresaSelector'
import { FormAccion } from '@/components/FormAccion'
import { administraEmpresa } from '@/access'
import { contexto, empresasDelUsuario } from '@/lib/payload'
import { usuariosDeEmpresa } from '@/servicios/usuarios'

export const metadata = { title: 'Usuarios' }

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const sp = await searchParams
  const { user, req } = await contexto('/portal/usuarios')
  const { empresas } = await empresasDelUsuario(user)
  const administradas = empresas.filter((e) => administraEmpresa(user, e.id))
  const empresa = administradas.find((e) => String(e.id) === sp.empresa) ?? administradas[0]
  if (!empresa) notFound()
  const usuarios = await usuariosDeEmpresa(req, empresa.id)
  const admins = usuarios.filter((u) => u.rol === 'admin' && u.activo).length

  return (
    <>
      <EmpresaSelector empresas={administradas.map((e) => ({ id: String(e.id), nombre: e.razonSocial }))} activa={String(empresa.id)} />
      <div className="stack" style={{ gap: 4 }}>
        {administradas.length < 2 ? <p className="small muted">{empresa.razonSocial}</p> : null}
        <h1>Usuarios</h1>
        <p className="muted">Dé acceso a las personas de su empresa. Si ya tienen cuenta en el portal por otra empresa, se les añade esta. Siempre debe quedar al menos un administrador.</p>
      </div>

      <section className="card stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Invitar a una persona</h2>
        <FormAccion accion={invitar} className="stack">
          <input type="hidden" name="empresa" value={empresa.id} />
          <div className="invitar">
            <div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" required /></div>
            <div className="field"><label htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" /></div>
            <div className="field">
              <label htmlFor="rol">Rol</label>
              <select id="rol" name="rol" defaultValue="usuario">
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <button className="btn btn--primary">Enviar invitación</button>
          </div>
          <p className="hint">El usuario consulta y envía documentos. El administrador también gestiona los accesos de la empresa.</p>
        </FormAccion>
      </section>

      <ul className="usuarios">
        {usuarios.map((u) => {
          const yo = String(u.id) === String(user.id)
          const ultimoAdmin = u.rol === 'admin' && admins <= 1
          return (
            <li key={u.id} className="card usuarios__fila">
              <div className="usuarios__quien">
                <strong>{u.nombre}{yo ? <span className="tag" style={{ marginLeft: 8 }}>Usted</span> : null}</strong>
                <span className="small muted">{u.email}</span>
              </div>
              {!u.activo ? <span className="status status--negro">Desactivado</span> : u.pendiente ? <span className="status status--naranja">Invitación pendiente</span> : <span className="status status--verde">Activo</span>}
              <CambioRol accion={rol} empresa={empresa.id} usuario={u.id} rol={u.rol} nombre={u.nombre || u.email} bloqueado={ultimoAdmin} />
              <div className="usuarios__acciones">
                {u.pendiente ? (
                  <FormAccion accion={reenviar} discreto>
                    <input type="hidden" name="empresa" value={empresa.id} />
                    <input type="hidden" name="usuario" value={u.id} />
                    <button className="btn btn--ghost btn--sm">Reenviar invitación</button>
                  </FormAccion>
                ) : null}
                {!ultimoAdmin ? (
                  <FormAccion accion={quitar} discreto confirmar={`¿Retirar el acceso de ${u.nombre} a ${empresa.razonSocial}?`}>
                    <input type="hidden" name="empresa" value={empresa.id} />
                    <input type="hidden" name="usuario" value={u.id} />
                    <button className="btn btn--ghost btn--sm error">Quitar acceso</button>
                  </FormAccion>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
