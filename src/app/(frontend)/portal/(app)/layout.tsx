import Link from 'next/link'
import { LogoutButton } from '@/components/LogoutButton'
import { NavPortal, type Enlace } from '@/components/NavPortal'
import { dosFactorObligatorio, empresasDe } from '@/access'
import { contexto } from '@/lib/payload'
import type { Empresa, Media } from '@/payload-types'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { payload, user, cmc } = await contexto()
  const esAdmin = cmc || empresasDe(user, true).length > 0
  const rolTexto = user.rol === 'superadmin' ? 'CMC · Super administrador' : esAdmin ? 'Administrador de empresa' : 'Usuario de empresa'
  const obligar2FA = user.rol === 'superadmin' && dosFactorObligatorio() && !user.totpActivo

  const [pendientes, sinLeer] = await Promise.all([
    cmc ? payload.count({ collection: 'envios', where: { estado: { equals: 'pendiente' } }, overrideAccess: true }) : null,
    payload.count({ collection: 'hilos', where: { estado: { equals: 'abierto' } }, user, overrideAccess: false }),
  ])

  // El logotipo de la empresa del cliente personaliza el portal (RF-22).
  const primera = !cmc && user.empresas?.[0] ? (user.empresas[0].empresa as Empresa) : null
  const logo = primera && typeof primera === 'object' && primera.logo && typeof primera.logo === 'object' ? (primera.logo as Media) : null

  const enlaces: Enlace[] = [
    { href: '/portal', texto: cmc ? 'Panel de empresas' : 'Panel', icono: 'grid' },
    { href: '/portal/documentos', texto: 'Documentos', icono: 'search' },
    { href: '/portal/enviar', texto: cmc ? 'Bandeja de envíos' : 'Enviar a CMC', icono: 'upload', aviso: pendientes?.totalDocs },
    { href: '/portal/mensajes', texto: 'Comunicación con CMC', icono: 'chat', aviso: sinLeer.totalDocs },
    { href: '/portal/avisos', texto: 'Avisos', icono: 'bell' },
    ...(esAdmin ? ([{ href: '/portal/usuarios', texto: 'Usuarios', icono: 'users' }, { href: '/portal/actividad', texto: 'Registro de actividad', icono: 'list' }] as Enlace[]) : []),
    ...(cmc ? ([{ href: '/portal/almacenamiento', texto: 'Almacenamiento', icono: 'database' }, { href: '/admin', texto: 'Administración', icono: 'settings', externo: true }] as Enlace[]) : []),
    { href: '/portal/asistentes', texto: 'Asistentes de IA', icono: 'key' },
    { href: '/portal/seguridad', texto: 'Seguridad', icono: 'shield' },
  ]

  return (
    <div className="portal">
      <aside className="portal__side">
        <Link href="/portal" className="wordmark" style={{ paddingInline: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- el logotipo puede venir de S3 */}
          {logo?.url ? <img src={logo.url} alt={primera?.razonSocial ?? ''} style={{ maxHeight: 40, maxWidth: 160 }} /> : <b style={{ fontSize: 26 }}>CMC</b>}
          <span>Portal documental</span>
        </Link>
        <NavPortal enlaces={enlaces} obligar2FA={obligar2FA} />
        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--line)' }} className="stack">
          <span className="small"><strong>{user.nombre}</strong><br /><span className="muted">{rolTexto}</span></span>
          <LogoutButton />
        </div>
      </aside>
      <main className="portal__main">{children}</main>
    </div>
  )
}
