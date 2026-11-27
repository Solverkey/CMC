import { notFound } from 'next/navigation'
import { cambiarEquipo, invitar, invitarEquipo, quitar, reenviar, rol } from '../../acciones'
import { EmpresaSelector } from '@/components/EmpresaSelector'
import { FormAccion } from '@/components/FormAccion'
import { administraEmpresa } from '@/access'
import { contexto, empresasDelUsuario, fmtHora } from '@/lib/payload'
import { equipoCmc, usuariosDeEmpresa } from '@/servicios/usuarios'

export const metadata = { title: 'Usuarios' }

export default async function UsuariosPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const sp = await searchParams
  const { user, req, cmc } = await contexto('/portal/usuarios')
  const { empresas } = await empresasDelUsuario(user)
  const administradas = empresas.filter((e) => administraEmpresa(user, e.id))
  const empresa = administradas.find((e) => String(e.id) === sp.empresa) ?? administradas[0]
  if (!empresa) notFound()
  const [usuarios, equipo] = await Promise.all([usuariosDeEmpresa(req, empresa.id), cmc ? equipoCmc(req) : null])
  const equipoActivo = (equipo ?? []).filter((p) => p.activo).length
  const admins = usuarios.filter((u) => u.rol === 'admin' && u.activo).length

  return (
    <>
      {equipo && (
        <section className="stack" style={{ gap: 12 }} aria-labelledby="equipo-cmc">
          <div className="stack" style={{ gap: 4 }}>
            <p className="small muted">CMC</p>
            <h1 id="equipo-cmc">Equipo de CMC</h1>
            <p className="muted">Personas de CMC con acceso a todas las empresas. Al entrar por primera vez tienen que activar el doble factor. Quien recibe avisos recibe por correo los avisos internos (renovaciones, envíos, mensajes sin asignar).</p>
          </div>
          <FormAccion accion={invitarEquipo} className="card row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '2 1 240px' }}><label htmlFor="email-cmc">Correo electrónico</label><input id="email-cmc" name="email" type="email" required /></div>
            <div className="field" style={{ flex: '2 1 200px' }}><label htmlFor="nombre-cmc">Nombre</label><input id="nombre-cmc" name="nombre" /></div>
            <button className="btn btn--primary">Invitar a CMC</button>
          </FormAccion>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Persona</th><th>Doble factor</th><th>Avisos internos</th><th>Último acceso</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {equipo.map((p) => {
                  const yo = String(p.id) === String(user.id)
                  return (
                    <tr key={p.id}>
                      <td><strong>{p.nombre}</strong>{yo && <span className="tag" style={{ marginLeft: 6 }}>Usted</span>}<span className="muted" style={{ display: 'block' }}>{p.email}</span></td>
                      <td>{p.dobleFactor ? <span className="status status--verde">Activado</span> : <span className="status status--naranja">Pendiente</span>}</td>
                      <td>
                        <FormAccion accion={cambiarEquipo}>
                          <input type="hidden" name="usuario" value={p.id} />
                          <input type="hidden" name="accion" value={p.recibeAvisos ? 'avisos-no' : 'avisos-si'} />
                          <span className="row small" style={{ gap: 6 }}>
                            {p.recibeAvisos ? 'Los recibe' : <span className="muted">No los recibe</span>}
                            <button className="enlace small">{p.recibeAvisos ? 'Quitar' : 'Activar'}</button>
                          </span>
                        </FormAccion>
                      </td>
                      <td className="small">{p.ultimoAcceso ? fmtHora(p.ultimoAcceso) : <span className="muted">Nunca</span>}</td>
                      <td>{!p.activo ? <span className="status status--negro">Desactivado</span> : p.pendiente ? <span className="status status--naranja">Invitación pendiente</span> : <span className="status status--verde">Activo</span>}</td>
                      <td>
                        {!yo && (p.activo ? equipoActivo > 1 : true) && (
                          <FormAccion accion={cambiarEquipo} confirmar={p.activo ? `¿Desactivar a ${p.nombre}? Se cerrarán sus sesiones y sus accesos de IA.` : undefined}>
                            <input type="hidden" name="usuario" value={p.id} />
                            <input type="hidden" name="accion" value={p.activo ? 'desactivar' : 'activar'} />
                            <button className={`btn btn--ghost btn--sm${p.activo ? ' error' : ''}`}>{p.activo ? 'Desactivar' : 'Reactivar'}</button>
                          </FormAccion>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 'var(--space-4) 0 0' }} />
        </section>
      )}
      <EmpresaSelector empresas={administradas.map((e) => ({ id: String(e.id), nombre: e.razonSocial }))} activa={String(empresa.id)} />
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{empresa.razonSocial}</p>
        {cmc ? <h2>Usuarios de la empresa</h2> : <h1>Usuarios</h1>}
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
