import Link from 'next/link'
import type { Where } from 'payload'
import { Icon } from '@/components/Icon'
import { contexto, empresasDelUsuario, fmtHora } from '@/lib/payload'
import type { Documento, Empresa, Hilo, User } from '@/payload-types'

export const metadata = { title: 'Comunicación con CMC' }

export default async function MensajesPage({ searchParams }: { searchParams: Promise<{ empresa?: string; estado?: string; mias?: string; q?: string }> }) {
  const sp = await searchParams
  const { payload, user, cmc } = await contexto('/portal/mensajes')
  const { empresas, empresa } = await empresasDelUsuario(user, sp.empresa)
  const estado = sp.estado === 'resuelto' || sp.estado === 'todos' ? sp.estado : 'abierto'

  const and: Where[] = []
  if (sp.empresa) and.push({ empresa: { equals: sp.empresa } })
  if (estado !== 'todos') and.push({ estado: { equals: estado } })
  if (cmc && sp.mias) and.push({ asignado: { equals: user.id } })
  if (sp.q) and.push({ asunto: { like: sp.q } })
  const hilos = await payload.find({ collection: 'hilos', where: { and }, user, overrideAccess: false, depth: 1, limit: 200, sort: '-ultimoMensaje' })
  const enlace = (extra: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ ...sp, ...extra }).filter(([, v]) => v) as [string, string][])}`

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="stack" style={{ gap: 4 }}>
          <p className="small muted">{sp.empresa && empresa ? empresa.razonSocial : cmc ? 'Todas las empresas' : 'Sus conversaciones'}</p>
          <h1>Comunicación con CMC</h1>
          <p className="muted">Consultas, comentarios y archivos, ordenados por conversación. Todo queda registrado y se puede exportar.</p>
        </div>
        <div className="row">
          {empresa && <a className="btn btn--secondary btn--sm" href={`/api/comunicaciones/${empresa.id}`}><Icon name="download" />Exportar (PDF)</a>}
          {empresa && <Link className="btn btn--primary" href={`/portal/mensajes/nuevo?empresa=${empresa.id}`}><Icon name="chat" />Nueva conversación</Link>}
        </div>
      </div>

      <form className="row" role="search">
        {empresas.length > 1 && (
          <select className="input" name="empresa" defaultValue={sp.empresa ?? ''} aria-label="Empresa">
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial}</option>)}
          </select>
        )}
        <input className="input" name="q" defaultValue={sp.q} placeholder="Buscar por asunto" aria-label="Buscar" style={{ flex: '1 1 220px' }} />
        <select className="input" name="estado" defaultValue={estado} aria-label="Estado">
          <option value="abierto">Abiertas</option>
          <option value="resuelto">Resueltas</option>
          <option value="todos">Todas</option>
        </select>
        {cmc && <label className="row small" style={{ gap: 6 }}><input type="checkbox" name="mias" value="1" defaultChecked={Boolean(sp.mias)} />Asignadas a mí</label>}
        <button className="btn btn--secondary">Filtrar</button>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Asunto</th>
              {(cmc || empresas.length > 1) && <th>Empresa</th>}
              <th>Sobre</th>
              <th>Asignado</th>
              <th>Último mensaje</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {hilos.docs.length === 0 && <tr><td colSpan={6} className="muted">No hay conversaciones. <Link href={enlace({ estado: 'todos' })}>Ver todas</Link></td></tr>}
            {(hilos.docs as Hilo[]).map((h) => (
              <tr key={h.id}>
                <td><Link href={`/portal/mensajes/${h.id}`}>{h.asunto}</Link></td>
                {(cmc || empresas.length > 1) && <td>{(h.empresa as Empresa)?.razonSocial}</td>}
                <td className="muted">{(h.documento as Documento)?.titulo ?? (typeof h.categoria === 'object' && h.categoria ? h.categoria.nombre : 'General')}</td>
                <td>{(h.asignado as User)?.nombre ?? <span className="muted">Sin asignar</span>}</td>
                <td>{fmtHora(h.ultimoMensaje)}</td>
                <td><span className={`status status--${h.estado === 'resuelto' ? 'verde' : 'naranja'}`}>{h.estado === 'resuelto' ? 'Resuelto' : 'Abierto'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
