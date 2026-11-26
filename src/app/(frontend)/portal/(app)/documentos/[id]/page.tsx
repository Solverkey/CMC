import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BotonDescarga } from '@/components/BotonDescarga'
import { EditarDocumento } from '@/components/EditarDocumento'
import { VisorArchivo } from '@/components/VisorArchivo'
import { Icon } from '@/components/Icon'
import { StatusBadge } from '@/components/StatusBadge'
import { SubirDocumento } from '@/components/SubirDocumento'
import { resolverGestion, type Estado } from '@/lib/estado'
import { leerConfiguracion } from '@/lib/configuracion'
import { tamano } from '@/lib/subidas'
import { archivosDeDocumento, categoriasDeEmpresa, documentoPorId, listarHilos } from '@/datos/consultas'
import type { Archivo, Categoria, Empresa, User } from '@/datos/tipos'
import { contexto, fmt, fmtHora, idDe } from '@/lib/payload'

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, cmc } = await contexto(`/portal/documentos/${id}`)
  const doc = await documentoPorId(id, user)
  if (!doc) notFound()

  const empresa = doc.empresa as Empresa
  const categoria = doc.categoria as Categoria
  const [archivos, hilos, categorias] = await Promise.all([
    archivosDeDocumento(doc.id),
    listarHilos(user, 'AND documento_id = $1 ORDER BY ultimo_mensaje DESC LIMIT 50', [doc.id]),
    categoriasDeEmpresa(empresa.id, { archivadas: false }),
  ])
  const vigenteId = idDe(doc.archivoVigente)
  const vigente = archivos.find((a) => String(a.id) === vigenteId) ?? archivos.find((a) => !a.historico && a.efectos?.includes('sustituye'))
  const gestion = resolverGestion(empresa?.gestion, categoria?.gestion, doc.gestion)
  const tecnico = [doc.tecnico, categoria?.responsable, empresa?.tecnico].find((t) => t && typeof t === 'object') as User | undefined
  const cfg = await leerConfiguracion()
  const mesesAviso = typeof categoria?.antelacionMeses === 'number' ? categoria.antelacionMeses : typeof empresa?.antelacionMeses === 'number' ? empresa.antelacionMeses : cfg.antelacionMeses

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
          {vigente?.url && <BotonDescarga url={vigente.url} nombre={vigente.filename} className="btn btn--primary"><Icon name="download" />Descargar</BotonDescarga>}
          <Link href={`/portal/mensajes/nuevo?empresa=${empresa.id}&documento=${doc.id}`} className="btn btn--secondary"><Icon name="chat" />{cmc ? 'Escribir al cliente' : 'Preguntar a CMC'}</Link>
          {cmc && (
            <EditarDocumento
              id={String(doc.id)}
              empresaId={String(empresa.id)}
              categorias={categorias.map((c) => ({ id: String(c.id), nombre: c.nombre }))}
              valores={{
                titulo: doc.titulo,
                categoria: String(idDe(doc.categoria)),
                referencia: doc.referencia ?? '',
                organismo: doc.organismo ?? '',
                fechaEmision: doc.fechaEmision?.slice(0, 10) ?? '',
                fechaCaducidad: doc.fechaCaducidad?.slice(0, 10) ?? '',
                fechaAviso: doc.fechaAviso?.slice(0, 10) ?? '',
                estadoManual: doc.estadoManual ?? '',
                motivoEstado: doc.motivoEstado ?? '',
                limiteSubsanacion: doc.limiteSubsanacion?.slice(0, 10) ?? '',
                gestion: doc.gestion ?? '',
                observaciones: doc.observaciones ?? '',
              }}
            />
          )}
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

          <section className="card stack">
            <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Archivo</h2>
            {vigente ? (
              <>
                <div className="file">
                  <Icon name="file" />
                  <span className="file__name">{vigente.filename}</span>
                  <span className="muted">{vigente.relacion} · {tamano(vigente.filesize)}</span>
                </div>
                {vigente.url && <VisorArchivo url={vigente.url} nombre={vigente.filename ?? 'documento'} mime={vigente.mimeType} />}
              </>
            ) : (
              <p className="muted">Este documento todavía no tiene archivo. La previsualización aparece cuando CMC publica el PDF en esta ficha.</p>
            )}
          </section>

          {cmc && (
            <section className="card stack">
              <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Añadir archivo</h2>
              <p className="muted">Renovación, subsanación o anexo. El archivo queda en el histórico y no se borra.</p>
              <SubirDocumento empresaId={String(empresa.id)} documentoId={String(doc.id)} meses={mesesAviso} variante="ficha" />
            </section>
          )}
        </div>

        <aside className="stack" style={{ flex: '1 1 320px', minWidth: 0 }}>
          <section className="card stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Conversaciones</h2>
              {hilos.length > 0 && <a className="small" href={`/api/comunicaciones/${empresa.id}?documento=${doc.id}`}>Exportar</a>}
            </div>
            {hilos.length === 0 && <p className="muted">Ninguna sobre este documento.</p>}
            {hilos.map((h) => (
              <Link key={h.id} href={`/portal/mensajes/${h.id}`} className="file" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Icon name="chat" />
                <span className="file__name">{h.asunto}</span>
                <span className="muted">{fmtHora(h.ultimoMensaje)}</span>
                <span className={`status status--${h.estado === 'resuelto' ? 'verde' : 'naranja'}`}>{h.estado === 'resuelto' ? 'Resuelto' : 'Abierto'}</span>
              </Link>
            ))}
          </section>
          <section className="card stack">
          <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Histórico</h2>
          <ol className="timeline">
            {archivos.length === 0 && <li className="muted">Sin archivos todavía.</li>}
            {archivos.map((a: Archivo) => {
              const esVigente = a.id === vigente?.id
              return (
              <li key={a.id} className={esVigente ? 'timeline--vigente' : a.historico ? 'timeline--pasado' : undefined}>
                <span className={`dot${a.historico ? ' dot--azul' : ''}`} aria-hidden="true" />
                <div className="stack" style={{ gap: 0 }}>
                  <strong>{a.relacion}{a.historico ? ' · Histórico' : a.id === vigente?.id ? ' · Vigente' : ''}</strong>
                  <span className="muted">{fmt(a.createdAt)}{typeof a.subidoPor === 'object' && a.subidoPor ? ` · ${a.subidoPor.nombre}` : ''}</span>
                  {a.url && <a href={a.url} target="_blank" rel="noreferrer">{a.filename}</a>}
                  {a.comentario && <span className="muted">{a.comentario}</span>}
                </div>
              </li>
              )
            })}
          </ol>
          </section>
        </aside>
      </div>
    </>
  )
}
