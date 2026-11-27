import { correoSinConfigurarEnServidor } from '@/lib/correo'

/** Para CMC: sin servidor de correo, los avisos e invitaciones se registran pero no llegan a nadie. Mejor decirlo. */
export function AvisoCorreo() {
  if (!correoSinConfigurarEnServidor()) return null
  return (
    <p role="alert" className="alert alert--error">
      <strong>El envío de correo no está configurado.</strong> Los avisos de caducidad, las invitaciones y los mensajes se registran pero no llegan a nadie.
      Hay que añadir en Vercel las variables <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> y <code>EMAIL_FROM</code> (con el dominio de CMC) y volver a desplegar.
    </p>
  )
}
