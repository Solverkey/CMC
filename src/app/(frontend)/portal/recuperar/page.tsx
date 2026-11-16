import { RecuperarForm } from '@/components/FormulariosAcceso'
import { PantallaAcceso } from '@/components/PantallaAcceso'

export const metadata = { title: 'Recuperar contraseña' }

export default function RecuperarPage() {
  return (
    <PantallaAcceso titulo="Recuperar contraseña" texto="Le enviaremos un enlace a su correo para elegir una nueva.">
      <RecuperarForm />
    </PantallaAcceso>
  )
}
