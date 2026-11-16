import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EnviarForm } from '@/components/EnviarForm'
import { Icon } from '@/components/Icon'
import { StatusBadge } from '@/components/StatusBadge'
import { fmt, requireUser } from '@/lib/payload'
import { resolverGestion, type Estado } from '@/lib/estado'
import type { Archivo, Categoria, Empresa } from '@/payload-types'

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user } = await requireUser()
  const doc = await payload.findByID({ collection: 'documentos', id, user, overrideAccess: false, depth: 1 }).catch(() => null)
  if (!doc) notFound()

  const empresa = doc.empresa as Empresa
  const categoria = doc.categoria as Categoria
  const archivos = await payload.find({ collection: 'archivos', user, overrideAccess: false, depth: 1, limit: 100, sort: '-createdAt', where: { documento: { equals: doc.id } } })
  const vigente = archivos.docs.find((a) => !a.historico)
  const gestion = resolverGestion(empresa?.gestion, categoria?.gestion, doc.gestion)

  return (
    <>
      <nav aria-label="Ruta" className="row small muted" style={{ gap: 8 }}>
        <Link href={`/portal?empresa=${empresa.id}`}>Panel</Link><span aria-hidden="true">/</span><span>{categoria?.nombre}</span><span aria-hidden="true">/</span><span>{doc.titulo}</span>
      </nav>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div className="stack" style={{ gap: 8, minWidth: 0 }}>
          <div className="row" style={{ gap: 8 }}>
            <StatusBadge estado={doc.estado as Estado} />
            {doc.estadoManual === 'amarillo' && doc.estado === 'naranja' && <StatusBadge estado="amarillo" />}
            {gestion === 'gestionado' && <span className="tag">Gestionado por CMC</span>}
          </div>
          <h1>{doc.titulo}</h1>
          <p className="muted">
            {gestion === 'gestionado'
              ? 'CMC se encarga de la renovación. No necesita hacer nada: le avisaremos cuando el nuevo documento esté disponible.'
              : 'Usted gestiona la renovación de este documento. Cuando disponga del nuevo, envíelo a CMC desde esta página.'}
          </p>
          {doc.estadoManual && doc.motivoEstado && <p className="small"><strong>Motivo:</strong> {doc.motivoEstado}</p>}
        </div>
        {vigente?.url && <a href={vigente.url} className="btn btn--primary" download><Icon name="download" />Descargar</a>}
      </div>

      <div className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '999 1 560px', minWidth: 0, gap: 24 }}>
          <section className="card stack">
            <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Datos del documento</h2>
            <dl className="dl">
              <div><dt>Referencia</dt><dd>{doc.referencia || '—'}</dd></div>
              <div><dt>Organismo emisor</dt><dd>{doc.organismo || '—'}</dd></div>
              <div><dt>Categoría</dt><dd>{categoria?.nombre}</dd></div>
              <div><dt>Fecha de emisión</dt><dd>{fmt(doc.fechaEmision)}</dd></div>
              <div><dt>Fecha de caducidad</dt><dd>{doc.fechaCaducidad ? fmt(doc.fechaCaducidad) : 'Indefinido'}</dd></div>
              <div><dt>Fecha de aviso</dt><dd>{fmt(doc.fechaAviso)}</dd></div>
            </dl>
          </section>

          {vigente && (
            <section className="card stack">
              <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Archivo vigente</h2>
              <div className="file">
                <Icon name="file" />
                <span className="file__name">{vigente.filename}</span>
                <span className="muted">{vigente.relacion}</span>
                {vigente.url && <a className="btn btn--secondary btn--sm" href={vigente.url} target="_blank" rel="noreferrer">Previsualizar</a>}
              </div>
            </section>
          )}

          <section className="card stack">
            <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Enviar archivo a CMC</h2>
            <EnviarForm empresaId={String(empresa.id)} documentoId={String(doc.id)} tituloPorDefecto={doc.titulo} />
          </section>
        </div>

        <aside className="card stack" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Histórico</h2>
          <ol className="timeline">
            {archivos.docs.length === 0 && <li className="muted">Sin archivos todavía.</li>}
            {archivos.docs.map((a: Archivo) => (
              <li key={a.id}>
                <span className={`dot${a.historico ? ' dot--negro' : ''}`} aria-hidden="true" />
                <div className="stack" style={{ gap: 0 }}>
                  <strong>{a.relacion}{a.historico ? ' · No aplica' : ' · Vigente'}</strong>
                  <span className="muted">{fmt(a.createdAt)}{typeof a.subidoPor === 'object' && a.subidoPor ? ` · ${a.subidoPor.nombre}` : ''}</span>
                  {a.url && <a href={a.url} target="_blank" rel="noreferrer">{a.filename}</a>}
                  {a.comentario && <span className="muted">{a.comentario}</span>}
                </div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </>
  )
}
