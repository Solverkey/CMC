import { AutorizarForm } from '@/components/FormulariosAcceso'
import { PantallaAcceso } from '@/components/PantallaAcceso'
import { contexto } from '@/lib/payload'
import { validarAutorizacion } from '@/mcp/oauth'

export const metadata = { title: 'Autorizar asistente de IA' }

const CAMPOS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'] as const

export default async function AutorizarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams
  const params = Object.fromEntries(CAMPOS.filter((k) => sp[k]).map((k) => [k, String(sp[k])]))
  const { user } = await contexto(`/portal/oauth/autorizar?${new URLSearchParams(params)}`)
  const v = await validarAutorizacion(params)

  if ('error' in v)
    return (
      <PantallaAcceso titulo="No se puede autorizar" texto={v.error}>
        <a className="btn btn--secondary" href="/portal">Ir al portal</a>
      </PantallaAcceso>
    )

  return (
    <PantallaAcceso titulo="Autorizar asistente de IA" texto={<>«{v.cliente.nombre}» quiere acceder al portal en nombre de <strong>{user.email}</strong>.</>}>
      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
        <li>Verá solo la documentación de sus empresas, con sus mismos permisos.</li>
        <li>Podrá enviar documentos y mensajes a CMC en su nombre; las acciones importantes le pedirán confirmación.</li>
        <li>Todo lo que haga quedará en el registro de actividad, marcado como «Asistente de IA».</li>
        <li>Puede revocar el acceso cuando quiera en «Asistentes de IA».</li>
      </ul>
      <AutorizarForm params={params} />
    </PantallaAcceso>
  )
}
