import Link from 'next/link'
import { notFound } from 'next/navigation'
import { EnviarForm } from '@/components/EnviarForm'
import { VisorArchivo } from '@/components/VisorArchivo'
import { Icon } from '@/components/Icon'
import { StatusBadge } from '@/components/StatusBadge'
import { resolverGestion, type Estado } from '@/lib/estado'
import { tamano } from '@/lib/subidas'
import { contexto, fmt, fmtHora, idDe } from '@/lib/payload'
import type { Archivo, Categoria, Empresa, User } from '@/payload-types'

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user, cmc } = await contexto(`/portal/documentos/${id}`)
  const doc = await payload.findByID({ collection: 'documentos', id, user, overrideAccess: false, depth: 1 }).catch(() => null)
  if (!doc) notFound()

  const empresa = doc.empresa as Empresa
  const categoria = doc.categoria as Categoria
  const [archivos, hilos] = await Promise.all([
    payload.find({ collection: 'archivos', user, overrideAccess: false, depth: 1, limit: 200, sort: '-createdAt', where: { documento: { equals: doc.id } } }),
    payload.find({ collection: 'hilos', user, overrideAccess: false, depth: 0, limit: 50, sort: '-ultimoMensaje', where: { documento: { equals: doc.id } } }),
  ])
  const vigenteId = idDe(doc.archivoVigente)
  // Un anexo (complementario) nunca es el vigente; si el documento no lo tiene fijado, el último que sustituye.
  const vigente = archivos.docs.find((a) => String(a.id) === vigenteId) ?? archivos.docs.find((a) => !a.historico && a.efectos?.includes('sustituye'))
  const gestion = resolverGestion(empresa?.gestion, categoria?.gestion, doc.gestion)
  const tecnico = [doc.tecnico, categoria?.responsable, empresa?.tecnico].find((t) => t && typeof t === 'object') as User | undefined

  return (
    <>
      <nav aria-label="Ruta" className="row small muted" style={{ gap: 8 }}>
        <Link href={`/portal?empresa=${empresa.id}`}>{empresa.razonSocial}</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/portal/documentos?empresa=${empresa.id}&categoria=${categoria?.id}`}>{categoria?.nombre}</Link>
        <span aria-hidden="true">/</span>
        <span>{doc.titulo}</span>
      </nav>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div className="stack" style={{ gap: 8, minWidth: 0, flex: '1 1 420px' }}>
          <div className="row" style={{ gap: 8 }}>
            <StatusBadge estado={doc.estado as Estado} />
            {doc.estadoManual === 'naranja' && doc.estado !== 'naranja' && <StatusBadge estado="naranja" />}
            <span className="tag">{gestion === 'gestionado' ? 'Gestionado por CMC' : 'No gestionado'}</span>
          </div>
          <h1>{doc.titulo}</h1>
          <p className="muted">
            {gestion === 'gestionado'
              ? 'CMC se encarga de la renovación. No necesita hacer nada: le avisaremos cuando el nuevo documento esté disponible.'
              : 'Usted gestiona la renovación de este documento. Cuando disponga del nuevo, envíelo a CMC desde esta página.'}
          </p>
          {doc.estadoManual && doc.motivoEstado && (
            <p className="alert" style={{ background: 'var(--surface-sunken)' }}>
              <strong>Motivo:</strong> {doc.motivoEstado}
              {doc.limiteSubsanacion && <> · Subsanar antes del {fmt(doc.limiteSubsanacion)}</>}
            </p>
          )}
        </div>
        <div className="row">
          {vigente?.url && <a href={vigente.url} className="btn btn--primary" download><Icon name="download" />Descargar</a>}
          <Link href={`/portal/mensajes/nuevo?empresa=${empresa.id}&documento=${doc.id}`} className="btn btn--secondary"><Icon name="chat" />Preguntar a CMC</Link>
          {cmc && <Link href={`/portal/documentos/${doc.id}/editar`} className="btn btn--secondary"><Icon name="settings" />Editar</Link>}
        </div>
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
              {tecnico && <div><dt>Técnico de CMC</dt><dd>{tecnico.nombre}</dd></div>}
            </dl>
            {doc.observaciones && <p className="small">{doc.observaciones}</p>}
          </section>

          {vigente && (
            <section className="card stack">
              <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Archivo vigente</h2>
              <div className="file">
                <Icon name="file" />
                <span className="file__name">{vigente.filename}</span>
                <span className="muted">{vigente.relacion} · {tamano(vigente.filesize)}</span>
              </div>
              {vigente.url && <VisorArchivo url={vigente.url} nombre={vigente.filename ?? 'documento'} mime={vigente.mimeType} />}
            </section>
          )}

          <section className="card stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Conversaciones sobre este documento</h2>
              {hilos.totalDocs > 0 && <a className="small" href={`/api/comunicaciones/${empresa.id}?documento=${doc.id}`}>Exportar historial (PDF)</a>}
            </div>
            {hilos.docs.length === 0 && <p className="muted">Ninguna todavía.</p>}
            {hilos.docs.map((h) => (
              <Link key={h.id} href={`/portal/mensajes/${h.id}`} className="file" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Icon name="chat" />
                <span className="file__name">{h.asunto}</span>
                <span className="muted">{fmtHora(h.ultimoMensaje)}</span>
                <span className={`status status--${h.estado === 'resuelto' ? 'verde' : 'naranja'}`}>{h.estado === 'resuelto' ? 'Resuelto' : 'Abierto'}</span>
              </Link>
            ))}
          </section>

          {!cmc && (
            <section className="card stack">
              <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Enviar archivo a CMC</h2>
              <EnviarForm empresaId={String(empresa.id)} documentoId={String(doc.id)} tituloPorDefecto={doc.titulo} categoriaId={categoria?.id ? String(categoria.id) : undefined} />
            </section>
          )}
        </div>

        <aside className="card stack" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Histórico</h2>
          <ol className="timeline">
            {archivos.docs.length === 0 && <li className="muted">Sin archivos todavía.</li>}
            {archivos.docs.map((a: Archivo) => (
              <li key={a.id}>
                <span className={`dot${a.historico ? ' dot--azul' : ''}`} aria-hidden="true" />
                <div className="stack" style={{ gap: 0 }}>
                  <strong>{a.relacion}{a.historico ? ' · Histórico' : a.id === vigente?.id ? ' · Vigente' : ''}</strong>
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
