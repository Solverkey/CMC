import { notFound } from 'next/navigation'
import { invitar, quitar, reenviar, rol } from '../../acciones'
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
        <p className="small muted">{empresa.razonSocial}</p>
        <h1>Usuarios</h1>
        <p className="muted">Dé acceso a las personas de su empresa. Si ya tienen cuenta en el portal por otra empresa, se les añade esta. Siempre debe quedar al menos un administrador.</p>
      </div>

      <section className="card stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Invitar a una persona</h2>
        <FormAccion accion={invitar} className="stack">
          <input type="hidden" name="empresa" value={empresa.id} />
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '2 1 240px' }}><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" required /></div>
            <div className="field" style={{ flex: '2 1 200px' }}><label htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" /></div>
            <div className="field" style={{ flex: '1 1 160px' }}>
              <label htmlFor="rol">Rol</label>
              <select id="rol" name="rol" defaultValue="usuario">
                <option value="usuario">Usuario (consulta y envía)</option>
                <option value="admin">Administrador (gestiona usuarios)</option>
              </select>
            </div>
            <button className="btn btn--primary">Enviar invitación</button>
          </div>
        </FormAccion>
      </section>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Persona</th><th>Rol</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {usuarios.map((u) => {
              const yo = String(u.id) === String(user.id)
              const ultimoAdmin = u.rol === 'admin' && admins <= 1
              return (
                <tr key={u.id}>
                  <td><strong>{u.nombre}</strong>{yo && <span className="tag" style={{ marginLeft: 6 }}>Usted</span>}<span className="muted" style={{ display: 'block' }}>{u.email}</span></td>
                  <td>
                    <FormAccion accion={rol} className="row" style={{ gap: 6 }}>
                      <input type="hidden" name="empresa" value={empresa.id} />
                      <input type="hidden" name="usuario" value={u.id} />
                      <select name="rol" defaultValue={u.rol} aria-label={`Rol de ${u.nombre}`} className="input" disabled={ultimoAdmin}>
                        <option value="usuario">Usuario</option>
                        <option value="admin">Administrador</option>
                      </select>
                      {!ultimoAdmin && <button className="btn btn--ghost btn--sm">Cambiar</button>}
                    </FormAccion>
                  </td>
                  <td>{!u.activo ? <span className="status status--negro">Desactivado</span> : u.pendiente ? <span className="status status--naranja">Invitación pendiente</span> : <span className="status status--verde">Activo</span>}</td>
                  <td>
                    <div className="row" style={{ justifyContent: 'flex-end' }}>
                      {u.pendiente && (
                        <FormAccion accion={reenviar}>
                          <input type="hidden" name="empresa" value={empresa.id} />
                          <input type="hidden" name="usuario" value={u.id} />
                          <button className="btn btn--ghost btn--sm">Reenviar invitación</button>
                        </FormAccion>
                      )}
                      {!ultimoAdmin && (
                        <FormAccion accion={quitar} confirmar={`¿Retirar el acceso de ${u.nombre} a ${empresa.razonSocial}?`}>
                          <input type="hidden" name="empresa" value={empresa.id} />
                          <input type="hidden" name="usuario" value={u.id} />
                          <button className="btn btn--ghost btn--sm error">Quitar acceso</button>
                        </FormAccion>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
