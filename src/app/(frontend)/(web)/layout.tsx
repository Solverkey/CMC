import { SiteFooter, SiteHeader } from '@/components/SiteHeader'
import { payloadClient } from '@/lib/payload'
import { leerWeb } from '@/lib/web'

// El contenido se edita en Administración → Web y se ve al momento.
export const dynamic = 'force-dynamic'

export default async function WebLayout({ children }: { children: React.ReactNode }) {
  const web = await leerWeb(await payloadClient())
  return (
    <>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <SiteHeader />
      <main id="contenido">{children}</main>
      <SiteFooter web={web} />
    </>
  )
}
