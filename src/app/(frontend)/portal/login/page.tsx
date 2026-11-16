import { PantallaAcceso } from '@/components/PantallaAcceso'
import { LoginForm } from './LoginForm'

export const metadata = { title: 'Acceso' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return (
    <PantallaAcceso titulo="Acceso al portal" texto="Consulte su documentación y envíe renovaciones a CMC.">
      <LoginForm next={next} />
    </PantallaAcceso>
  )
}
