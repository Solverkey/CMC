import Link from 'next/link'
import { notFound } from 'next/navigation'
import { gestionarHilo } from '../../../acciones'
import { AdjuntoARevision } from '@/components/AdjuntoARevision'
import { FormAccion } from '@/components/FormAccion'
import { Icon } from '@/components/Icon'
import { MensajeForm } from '@/components/MensajeForm'
import { tamano } from '@/lib/subidas'
import { contexto, fmtHora, idDe } from '@/lib/payload'
import type { Adjunto, Documento, Empresa, Hilo, Mensaje, User } from '@/payload-types'

export default async function ConversacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user, cmc } = await contexto(`/portal/mensajes/${id}`)
  const hilo = (await payload.findByID({ collection: 'hilos', id, user, overrideAccess: false, depth: 1 }).catch(() => null)) as Hilo | null
  if (!hilo) notFound()

  const empresa = hilo.empresa as Empresa
  const doc = hilo.documento as Documento | null
  const [mensajes, tecnicos] = await Promise.all([
    payload.find({ collection: 'mensajes', where: { hilo: { equals: hilo.id } }, user, overrideAccess: false, depth: 1, limit: 1000, sort: 'createdAt' }),
    cmc ? payload.find({ collection: 'users', where: { rol: { equals: 'superadmin' }, activo: { not_equals: false } }, depth: 0, limit: 200, overrideAccess: true, sort: 'nombre' }) : null,
  ])

  return (
    <>
      <Link href="/portal/mensajes" className="small">← Comunicación con CMC</Link>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="stack" style={{ gap: 4 }}>
          <p className="small muted">
            {empresa.razonSocial}
            {doc && <> · <Link href={`/portal/documentos/${doc.id}`}>{doc.titulo}</Link></>}
          </p>
          <h1>{hilo.asunto}</h1>
          <div className="row small">
            <span className={`status status--${hilo.estado === 'resuelto' ? 'verde' : 'naranja'}`}>{hilo.estado === 'resuelto' ? 'Resuelto' : 'Abierto'}</span>
            <span className="muted">Asignado a: {(hilo.asignado as User)?.nombre ?? 'sin asignar'}</span>
          </div>
        </div>
        <a className="btn btn--secondary btn--sm" href={`/api/comunicaciones/${empresa.id}${doc ? `?documento=${doc.id}` : ''}`}><Icon name="download" />Exportar (PDF)</a>
      </div>

      {cmc && tecnicos && (
        <FormAccion accion={gestionarHilo} className="card row" style={{ alignItems: 'flex-end' }}>
          <input type="hidden" name="hilo" value={hilo.id} />
          <div className="field">
            <label htmlFor="asignado">Persona de CMC asignada</label>
            <select id="asignado" name="asignado" defaultValue={idDe(hilo.asignado)}>
              <option value="">Sin asignar</option>
              {tecnicos.docs.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="estado">Estado</label>
            <select id="estado" name="estado" defaultValue={hilo.estado ?? 'abierto'}>
              <option value="abierto">Abierto</option>
              <option value="resuelto">Resuelto</option>
            </select>
          </div>
          <button className="btn btn--secondary">Guardar</button>
        </FormAccion>
      )}

      <ol className="hilo">
        {(mensajes.docs as Mensaje[]).map((m) => {
          const autor = m.autor as User | null
          const deCMC = autor?.rol === 'superadmin'
          return (
            <li key={m.id} className={`mensaje${deCMC ? ' mensaje--cmc' : ''}`}>
              <div className="row small" style={{ justifyContent: 'space-between' }}>
                <strong>{autor?.nombre ?? 'Usuario'}{deCMC ? ' · CMC' : ''}</strong>
                <time className="muted" dateTime={m.createdAt}>{fmtHora(m.createdAt)}</time>
              </div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</p>
              {(m.adjuntos ?? []).map((a) => {
                if (typeof a !== 'object') return null
                const adj = a as Adjunto
                return (
                  <div key={adj.id} className="file">
                    <Icon name="paperclip" />
                    <a className="file__name" href={adj.url ?? '#'} target="_blank" rel="noreferrer">{adj.filename}</a>
                    <span className="muted">{tamano(adj.filesize)}</span>
                    <AdjuntoARevision adjunto={String(adj.id)} documento={doc ? String(doc.id) : undefined} />
                  </div>
                )
              })}
            </li>
          )
        })}
      </ol>

      <section className="card">
        <MensajeForm empresaId={String(empresa.id)} hiloId={String(hilo.id)} />
        {hilo.estado === 'resuelto' && !cmc && <p className="hint" style={{ marginTop: 8 }}>Si responde, la conversación se volverá a abrir.</p>}
      </section>
    </>
  )
}
