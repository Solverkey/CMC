import { NuevaPasswordForm } from '@/components/FormulariosAcceso'
import { PantallaAcceso } from '@/components/PantallaAcceso'

export const metadata = { title: 'Elegir contraseña' }

export default async function RestablecerPage({ searchParams }: { searchParams: Promise<{ token?: string; invitacion?: string }> }) {
  const { token, invitacion } = await searchParams
  if (!token && !invitacion)
    return (
      <PantallaAcceso titulo="Enlace no válido" texto="Pida un nuevo enlace desde la pantalla de acceso.">
        <a className="btn btn--primary" href="/portal/recuperar">Recuperar contraseña</a>
      </PantallaAcceso>
    )
  return (
    <PantallaAcceso
      titulo={invitacion ? 'Bienvenido al portal de CMC' : 'Nueva contraseña'}
      texto={invitacion ? 'Elija una contraseña para activar su cuenta. Después podrá entrar con su correo.' : 'Elija una nueva contraseña para su cuenta.'}
    >
      <NuevaPasswordForm token={token} invitacion={invitacion} />
    </PantallaAcceso>
  )
}
