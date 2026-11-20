import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FilaEnlace } from '@/components/FilaEnlace'
import { tamano } from '@/lib/subidas'
import { listarEnvios } from '@/datos/consultas'
import type { Documento, Empresa, Envio, User } from '@/datos/tipos'
import { contexto, empresasDelUsuario, fmt, fmtHora } from '@/lib/payload'

export const metadata = { title: 'Bandeja de envíos' }

const ESTADO_ENVIO = { pendiente: 'naranja', publicado: 'verde', rechazado: 'rojo' } as const
const LABEL_ENVIO = { pendiente: 'Pendiente de revisión', publicado: 'Publicado', rechazado: 'Rechazado' } as const

export default async function EnviarPage({ searchParams }: { searchParams: Promise<{ empresa?: string; estado?: string }> }) {
  const sp = await searchParams
  const { user, cmc } = await contexto('/portal/enviar')
  const { empresa } = await empresasDelUsuario(user, sp.empresa)
  if (!empresa) return <p>No tiene ninguna empresa asignada.</p>
  if (!cmc) redirect(`/portal/documentos?empresa=${empresa.id}`)

  const estado = (['pendiente', 'publicado', 'rechazado'] as const).find((e) => e === sp.estado) ?? 'pendiente'
  const envios = await listarEnvios(
    user,
    `${cmc && !sp.empresa ? '' : 'AND empresa_id = $1 '}AND estado = $${cmc && !sp.empresa ? 1 : 2} ORDER BY created_at ${cmc ? 'ASC' : 'DESC'}`,
    cmc && !sp.empresa ? [estado] : [empresa.id, estado],
    100,
  )

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{sp.empresa ? empresa.razonSocial : 'Todas las empresas'}</p>
        <h1>Bandeja de envíos</h1>
        <p className="muted">Documentos enviados por los clientes. Revise cada uno, complete la categoría y las fechas, y publíquelo o rechácelo indicando el motivo.</p>
      </div>

      <section className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Envíos</h2>
          <nav className="row segmentado" aria-label="Estado">
            {(['pendiente', 'publicado', 'rechazado'] as const).map((e) => (
              <Link key={e} href={`?${new URLSearchParams({ ...(sp.empresa ? { empresa: sp.empresa } : {}), estado: e })}`} aria-current={estado === e ? 'true' : undefined} className="btn btn--sm">{LABEL_ENVIO[e]}</Link>
            ))}
          </nav>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Empresa</th>
                <th>Enviado</th>
                <th>Archivo</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {envios.length === 0 && <tr><td colSpan={5} className="muted">No hay envíos.</td></tr>}
              {envios.map((e) => {
                const doc = e.documentoRelacionado as Documento | null
                const por = e.enviadoPor as User | null
                return (
                  <FilaEnlace key={e.id} href={`/portal/enviar/${e.id}`}>
                    <td>
                      <strong>{e.titulo}</strong>
                      <span className="muted" style={{ display: 'block' }}>
                        {e.relacion}
                        {doc && typeof doc === 'object' ? ` de «${doc.titulo}»` : ''}
                        {e.nuevaCaducidad ? ` · caduca ${fmt(e.nuevaCaducidad)}` : ''}
                      </span>
                      {e.comentario && <span className="muted small" style={{ display: 'block' }}>{e.comentario}</span>}
                      {e.estado === 'rechazado' && e.motivoRechazo && <span className="error small" style={{ display: 'block' }}>Motivo: {e.motivoRechazo}</span>}
                    </td>
                    <td>{(e.empresa as Empresa)?.razonSocial}</td>
                    <td>{fmtHora(e.createdAt)}{por && typeof por === 'object' && <span className="muted" style={{ display: 'block' }}>{por.nombre}</span>}</td>
                    <td>
                      {e.filename}
                      <span className="muted" style={{ display: 'block' }}>
                        {tamano(e.filesize)}
                        {e.tamanoOriginal && e.tamanoOriginal !== e.filesize ? ` (original ${tamano(e.tamanoOriginal)})` : ''}
                      </span>
                    </td>
                    <td><span className={`status status--${ESTADO_ENVIO[e.estado ?? 'pendiente']}`}>{LABEL_ENVIO[e.estado ?? 'pendiente']}</span></td>
                  </FilaEnlace>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
