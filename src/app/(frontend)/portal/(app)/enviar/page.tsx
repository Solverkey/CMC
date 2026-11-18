import Link from 'next/link'
import { EmpresaSelector } from '@/components/EmpresaSelector'
import { EnviarForm } from '@/components/EnviarForm'
import { tamano } from '@/lib/subidas'
import { contexto, empresasDelUsuario, fmt, fmtHora } from '@/lib/payload'
import type { Documento, Empresa, Envio, User } from '@/payload-types'

export const metadata = { title: 'Envíos a CMC' }

const ESTADO_ENVIO = { pendiente: 'naranja', publicado: 'verde', rechazado: 'rojo' } as const
const LABEL_ENVIO = { pendiente: 'Pendiente de revisión', publicado: 'Publicado', rechazado: 'Rechazado' } as const

export default async function EnviarPage({ searchParams }: { searchParams: Promise<{ empresa?: string; estado?: string }> }) {
  const sp = await searchParams
  const { payload, user, cmc } = await contexto('/portal/enviar')
  const { empresas, empresa } = await empresasDelUsuario(user, sp.empresa)
  if (!empresa) return <p>No tiene ninguna empresa asignada.</p>

  const estado = (['pendiente', 'publicado', 'rechazado'] as const).find((e) => e === sp.estado) ?? (cmc ? 'pendiente' : undefined)
  const categorias = cmc ? null : await payload.find({ collection: 'categorias', where: { and: [{ empresa: { equals: empresa.id } }, { archivada: { not_equals: true } }] }, user, overrideAccess: false, depth: 0, limit: 200, sort: 'orden' })
  const envios = await payload.find({
    collection: 'envios',
    user,
    overrideAccess: false,
    depth: 1,
    limit: 100,
    sort: cmc ? 'createdAt' : '-createdAt',
    where: { and: [...(cmc && !sp.empresa ? [] : [{ empresa: { equals: empresa.id } }]), ...(estado ? [{ estado: { equals: estado } }] : [])] },
  })

  return (
    <>
      {!cmc && <EmpresaSelector empresas={empresas.map((e) => ({ id: String(e.id), nombre: e.razonSocial }))} activa={String(empresa.id)} />}
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{cmc ? (sp.empresa ? empresa.razonSocial : 'Todas las empresas') : empresa.razonSocial}</p>
        <h1>{cmc ? 'Bandeja de envíos' : 'Enviar documentos a CMC'}</h1>
        <p className="muted">
          {cmc
            ? 'Documentos enviados por los clientes. Revise cada uno, complete la categoría y las fechas, y publíquelo o recházelo indicando el motivo.'
            : 'CMC revisa cada envío, completa la categoría y las fechas, y lo publica en su portal. Le avisaremos por correo.'}
        </p>
      </div>
      {!cmc && <section className="card"><EnviarForm empresaId={String(empresa.id)} categorias={categorias?.docs.map((c) => ({ id: String(c.id), nombre: c.nombre })) ?? []} /></section>}

      <section className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 22, lineHeight: '28px' }}>{cmc ? 'Envíos' : 'Sus envíos'}</h2>
          <nav className="row segmentado" aria-label="Estado">
            {cmc ? null : <Link href={`?empresa=${empresa.id}`} aria-current={!estado ? 'true' : undefined} className="btn btn--sm">Todos</Link>}
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
                {cmc && <th>Empresa</th>}
                <th>Enviado</th>
                <th>Archivo</th>
                <th>Estado</th>
                {cmc && <th />}
              </tr>
            </thead>
            <tbody>
              {envios.docs.length === 0 && <tr><td colSpan={6} className="muted">No hay envíos.</td></tr>}
              {(envios.docs as Envio[]).map((e) => {
                const doc = e.documentoRelacionado as Documento | null
                const por = e.enviadoPor as User | null
                return (
                  <tr key={e.id}>
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
                    {cmc && <td>{(e.empresa as Empresa)?.razonSocial}</td>}
                    <td>{fmtHora(e.createdAt)}{por && typeof por === 'object' && <span className="muted" style={{ display: 'block' }}>{por.nombre}</span>}</td>
                    <td>
                      {e.url ? <a href={e.url} target="_blank" rel="noreferrer">{e.filename}</a> : e.filename}
                      <span className="muted" style={{ display: 'block' }}>
                        {tamano(e.filesize)}
                        {e.tamanoOriginal && e.tamanoOriginal !== e.filesize ? ` (original ${tamano(e.tamanoOriginal)})` : ''}
                      </span>
                    </td>
                    <td><span className={`status status--${ESTADO_ENVIO[e.estado ?? 'pendiente']}`}>{LABEL_ENVIO[e.estado ?? 'pendiente']}</span></td>
                    {cmc && <td>{e.estado === 'pendiente' && <a className="btn btn--primary btn--sm" href={`/admin/collections/envios/${e.id}`}>Revisar</a>}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
