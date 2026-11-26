import { CambiarPassword, DobleFactor } from '@/components/DobleFactor'
import { dosFactorObligatorio } from '@/access'
import { listarActividad } from '@/datos/consultas'
import { contexto, fmtHora } from '@/lib/payload'

export const metadata = { title: 'Seguridad' }

export default async function SeguridadPage() {
  const { user } = await contexto('/portal/seguridad')
  const obligatorio = user.rol === 'superadmin' && dosFactorObligatorio()
  const accesos = await listarActividad(null, `AND usuario_id = $1 AND accion IN ('login', 'login_fallido')`, [user.id], 10)

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{user.email}</p>
        <h1>Seguridad de su cuenta</h1>
      </div>

      {obligatorio && !user.totpActivo && (
        <p role="alert" className="alert alert--error">Como super administrador de CMC debe activar el doble factor antes de continuar. Hasta entonces su cuenta no tiene permisos de administración.</p>
      )}

      <section className="card stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Doble factor de autenticación</h2>
        <p className="muted">Además de la contraseña, se pide un código temporal de una aplicación de su móvil.{obligatorio ? ' Es obligatorio para CMC.' : ' Se recomienda activarlo.'}</p>
        <DobleFactor activo={Boolean(user.totpActivo)} obligatorio={obligatorio} />
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Contraseña</h2>
        <CambiarPassword id={String(user.id)} />
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Últimos accesos</h2>
        {accesos.length === 0 && <p className="small muted">Todavía no hay accesos registrados.</p>}
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {accesos.map((a) => (
            <li key={a.id}>{fmtHora(a.createdAt)} · {a.accion === 'login' ? 'Acceso correcto' : <span className="error">Intento fallido</span>}{a.ip ? ` · ${a.ip}` : ''}</li>
          ))}
        </ul>
      </section>
    </>
  )
}
