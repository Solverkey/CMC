import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { LogoutButton } from '@/components/LogoutButton'
import { requireUser } from '@/lib/payload'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser()
  const rolEmpresa = user.rol === 'superadmin' ? 'CMC · Super administrador' : user.empresas?.some((m) => m.rol === 'admin') ? 'Administrador de empresa' : 'Usuario de empresa'
  return (
    <div className="portal">
      <aside className="portal__side">
        <Link href="/" className="wordmark" style={{ paddingInline: 8 }}><b style={{ fontSize: 26 }}>CMC</b><span>Portal documental</span></Link>
        <nav className="side-nav" aria-label="Portal">
          <Link href="/portal"><Icon name="grid" />Panel</Link>
          <Link href="/portal/enviar"><Icon name="upload" />Enviar a CMC</Link>
          {user.rol === 'superadmin' && <a href="/admin"><Icon name="inbox" />Administración (CMC)</a>}
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line)' }} className="stack">
          <span className="small"><strong>{user.nombre}</strong><br /><span className="muted">{rolEmpresa}</span></span>
          <LogoutButton />
        </div>
      </aside>
      <main className="portal__main">{children}</main>
    </div>
  )
}
