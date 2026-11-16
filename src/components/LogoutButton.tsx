'use client'
import { useRouter } from 'next/navigation'
import { Icon } from './Icon'

export function LogoutButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className="btn btn--ghost btn--sm"
      onClick={async () => {
        await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
        router.push('/portal/login')
        router.refresh()
      }}
    >
      <Icon name="logout" /> Cerrar sesión
    </button>
  )
}
