import Link from 'next/link'
import { CerrarCalendario } from '@/components/CerrarCalendario'
import { MenuPortal } from '@/components/MenuPortal'
import { NavPortal, type Enlace } from '@/components/NavPortal'
import { PerfilPortal } from '@/components/PerfilPortal'
import { dosFactorObligatorio, empresasDe } from '@/access'
import { contar, contarNoLeidas } from '@/datos/consultas'
import type { Empresa } from '@/datos/tipos'
import { uno } from '@/lib/db'
import { urlDe } from '@/lib/ficheros'
import { contexto } from '@/lib/payload'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, cmc } = await contexto(undefined, { permitirSin2FA: true })
  const esAdmin = cmc || empresasDe(user, true).length > 0
  const rolTexto = user.rol === 'superadmin' ? 'CMC · Super administrador' : esAdmin ? 'Administrador de empresa' : 'Usuario de empresa'
  const obligar2FA = user.rol === 'superadmin' && dosFactorObligatorio() && !user.totpActivo

  // El contador de Comunicación cuenta las conversaciones con mensajes sin leer, como un correo.
  const [pendientes, sinLeer] = obligar2FA
    ? [0, 0]
    : await Promise.all([cmc ? contar('envios', "estado = 'pendiente'") : Promise.resolve(0), contarNoLeidas(user)])

  const primera = !cmc && user.empresas?.[0] ? (user.empresas[0].empresa as Empresa) : null
  const logoId = primera && typeof primera.logo === 'number' ? primera.logo : null
  const logoArchivo = logoId ? await uno<{ filename: string | null }>('SELECT filename FROM media WHERE id = $1', [logoId]) : null
  const logoUrl = logoArchivo?.filename ? await urlDe('media', logoArchivo.filename) : null

  const enlaces: Enlace[] = [
    { href: '/portal', texto: cmc ? 'Panel de empresas' : 'Panel', icono: 'grid' },
    { href: '/portal/documentos', texto: 'Documentos', icono: 'search' },
    ...(cmc ? ([{ href: '/portal/enviar', texto: 'Bandeja de envíos', icono: 'upload', aviso: pendientes || undefined }] as Enlace[]) : []),
    { href: '/portal/mensajes', texto: 'Comunicación', icono: 'chat', aviso: sinLeer || undefined },
    { href: '/portal/avisos', texto: 'Avisos', icono: 'bell' },
    ...(esAdmin ? ([{ href: '/portal/facturacion', texto: 'Facturación', icono: 'receipt' }] as Enlace[]) : []),
    ...(cmc ? ([{ href: '/portal/selectores', texto: 'Selectores', icono: 'select' }, { href: '/portal/configuracion', texto: 'Configuración', icono: 'settings' }] as Enlace[]) : []),
    ...(esAdmin ? ([{ href: '/portal/usuarios', texto: 'Usuarios', icono: 'users' }, { href: '/portal/actividad', texto: 'Registro de actividad', icono: 'clock' }] as Enlace[]) : []),
    ...(cmc ? ([{ href: '/portal/almacenamiento', texto: 'Almacenamiento', icono: 'database' }] as Enlace[]) : []),
  ]

  const perfil: Enlace[] = [
    { href: '/portal/asistentes', texto: 'Asistentes de IA', icono: 'key' },
    { href: '/portal/seguridad', texto: 'Seguridad', icono: 'shield' },
  ]

  return (
    <div className="portal">
      <CerrarCalendario />
      <aside className="portal__side">
        <Link href="/portal" className="wordmark" style={{ paddingInline: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- el logotipo puede venir de S3 */}
          {logoUrl ? <img src={logoUrl} alt={primera?.razonSocial ?? ''} style={{ maxHeight: 40, maxWidth: 160 }} /> : <img src="/marca/cmc.png" alt="" width={408} height={112} />}
          {logoUrl && <span>Portal documental</span>}
        </Link>
        <MenuPortal>
          <NavPortal enlaces={enlaces} obligar2FA={obligar2FA} />
          <PerfilPortal nombre={user.nombre} rol={rolTexto} enlaces={perfil} />
        </MenuPortal>
      </aside>
      <main className="portal__main">{children}</main>
    </div>
  )
}
