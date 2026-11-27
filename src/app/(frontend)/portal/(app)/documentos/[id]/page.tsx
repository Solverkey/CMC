import { Enlace as Link } from '@/components/Enlace'
import { notFound } from 'next/navigation'
import { BotonDescarga } from '@/components/BotonDescarga'
import { EditarDocumento } from '@/components/EditarDocumento'
import { EnviarCmc } from '@/components/EnviarCmc'
import { VisorArchivo } from '@/components/VisorArchivo'
import { Icon } from '@/components/Icon'
import { SubirDocumento } from '@/components/SubirDocumento'
import { ESTADOS, resolverGestion, type Estado } from '@/lib/estado'
import { leerConfiguracion } from '@/lib/configuracion'
import { plazo } from '@/lib/plazo'
import { tamano } from '@/lib/subidas'
import { archivosDeDocumento, categoriasDeEmpresa, documentoPorId, listarHilos } from '@/datos/consultas'
import type { Archivo, Categoria, Documento, Empresa, User } from '@/datos/tipos'
import { contexto, diasHasta, fmt, fmtHora, idDe } from '@/lib/payload'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user } = await contexto(`/portal/documentos/${id}`)
  const doc = await documentoPorId(id, user)
  return { title: doc ? doc.titulo : 'Documento' }
}

/** Qué significa el estado y qué toca hacer, según quién gestiona la renovación. */
function siguientePaso(d: Documento, estado: Estado, gestionado: boolean, cmc: boolean) {
  const quien = cmc ? 'el cliente' : 'usted'
  switch (estado) {
    case 'negro':
      return gestionado ? 'No legalizado. CMC está tramitando su legalización.' : `No legalizado. Hay que regularizarlo: ${cmc ? 'el cliente debe' : 'contacte con CMC para'} iniciar la legalización.`
    case 'azul':
      return 'Archivado: ya no está en vigor y no genera avisos. Se conserva como histórico.'
    case 'rojo':
      return gestionado ? 'Ha caducado. CMC está tramitando la renovación y avisará cuando esté publicada.' : `Ha caducado. ${cmc ? 'El cliente debe enviar' : 'Envíe'} la renovación en cuanto la tenga.`
    case 'amarillo':
      return gestionado ? 'Se acerca la caducidad. CMC se encarga de renovarlo a tiempo.' : `Se acerca la caducidad: toca renovarlo. ${cmc ? 'El cliente lo enviará' : 'Cuando tenga el nuevo, envíelo a CMC desde esta ficha'}.`
    case 'naranja':
      return `Condicionado hasta subsanar los defectos${d.limiteSubsanacion && !d.motivoEstado ? ` (límite: ${fmt(d.limiteSubsanacion)})` : ''}. ${gestionado ? 'CMC hace el seguimiento.' : `La subsanación corre a cargo de ${quien}.`}`
    default:
      return d.fechaAviso ? `En vigor. ${gestionado ? 'CMC empezará la renovación' : 'Recibirá el primer aviso'} el ${fmt(d.fechaAviso)}.` : 'En vigor.'
  }
}

/** Barra de vigencia: posición (en %) de hoy y del aviso entre la emisión y la caducidad. */
function barraVigencia(doc: Documento, ahora = Date.now()) {
  const t = (d?: string | null) => (d ? new Date(d).getTime() : null)
  const [ini, fin] = [t(doc.fechaEmision), t(doc.fechaCaducidad)]
  const pos = (x: number | null) => (ini !== null && fin !== null && x !== null && fin > ini ? Math.min(Math.max(((x - ini) / (fin - ini)) * 100, 0), 100) : null)
  return { posHoy: pos(ahora), posAviso: pos(t(doc.fechaAviso)) }
}

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, cmc } = await contexto(`/portal/documentos/${id}`)
  const doc = await documentoPorId(id, user)
  if (!doc) notFound()

  const empresa = doc.empresa as Empresa
  const categoria = doc.categoria as Categoria
  const [archivos, hilos, categorias, cfg] = await Promise.all([
    archivosDeDocumento(doc.id),
    listarHilos(user, 'AND documento_id = $1 ORDER BY ultimo_mensaje DESC LIMIT 50', [doc.id]),
    categoriasDeEmpresa(empresa.id, { archivadas: false }),
    leerConfiguracion(),
  ])
  const vigenteId = idDe(doc.archivoVigente)
  const vigente = archivos.find((a) => String(a.id) === vigenteId) ?? archivos.find((a) => !a.historico && a.efectos?.includes('sustituye'))
  const gestionado = resolverGestion(empresa?.gestion, categoria?.gestion, doc.gestion) === 'gestionado'
  const tecnico = [doc.tecnico, categoria?.responsable, empresa?.tecnico].find((t) => t && typeof t === 'object') as User | undefined
  const mesesAviso = typeof categoria?.antelacionMeses === 'number' ? categoria.antelacionMeses : typeof empresa?.antelacionMeses === 'number' ? empresa.antelacionMeses : cfg.antelacionMeses
  const estado = (doc.estado ?? 'verde') as Estado
  const condicionada = doc.estadoManual === 'naranja' && estado !== 'naranja'
  const dias = diasHasta(doc.fechaCaducidad)
  const p = plazo(dias)

  const { posHoy, posAviso } = barraVigencia(doc)

  return (
    <>
      <nav aria-label="Ruta" className="row small muted" style={{ gap: 8 }}>
        <Link href="/portal/documentos">Documentos</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/portal/documentos?empresa=${empresa.id}`}>{empresa.razonSocial}</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/portal/documentos?empresa=${empresa.id}&categoria=${categoria?.id}`}>{categoria?.nombre}</Link>
      </nav>

      <header className="ficha__cabeza">
        <div className="stack" style={{ gap: 8, minWidth: 0, flex: '1 1 420px' }}>
          <div className="row" style={{ gap: 8 }}>
            <span className={`status status--${estado}`}>{ESTADOS[estado].label}</span>
            {condicionada && <span className="status status--naranja">Condicionada</span>}
            <span className="mini"><Icon name={gestionado ? 'shield' : 'users'} size={12} />{gestionado ? 'Gestiona CMC' : cmc ? 'Gestiona el cliente' : 'Lo gestiona usted'}</span>
          </div>
          <h1 className="ficha__titulo">{doc.titulo}</h1>
          <p className="muted">{[doc.referencia, doc.organismo].filter(Boolean).join(' · ') || 'Sin referencia'}</p>
        </div>
        <div className="row ficha__acciones">
          {vigente?.url && <BotonDescarga url={vigente.url} nombre={vigente.filename} className="btn btn--primary"><Icon name="download" />Descargar</BotonDescarga>}
          {cmc ? (
            <SubirDocumento empresaId={String(empresa.id)} documentoId={String(doc.id)} meses={mesesAviso} clase={vigente ? 'btn btn--secondary' : 'btn btn--primary'} />
          ) : (
            <EnviarCmc
              empresaId={String(empresa.id)}
              empresaNombre={empresa.razonSocial}
              categorias={categorias.map((c) => ({ id: String(c.id), nombre: c.nombre }))}
              documentoId={String(doc.id)}
              documentoTitulo={doc.titulo}
              etiqueta={estado === 'rojo' || estado === 'amarillo' ? 'Enviar renovación' : 'Enviar archivo'}
              clase={vigente ? 'btn btn--secondary' : 'btn btn--primary'}
            />
          )}
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
      </header>

      <div className="ficha">
        <div className="ficha__principal">
          <section className={`card vigencia estado--${estado}`} aria-label="Vigencia">
            <div className="vigencia__cabeza">
              <div>
                <p className="eyebrow" style={{ color: 'var(--c)' }}>{ESTADOS[estado].label}</p>
                <p className={`vigencia__plazo plazo--${p.tono}`}>
                  {estado === 'negro' ? 'Pendiente de legalizar' : estado === 'azul' ? 'Archivado' : p.texto}
                </p>
                <p className="muted small">{doc.fechaCaducidad ? `Caducidad: ${fmt(doc.fechaCaducidad)}` : 'Sin fecha de caducidad'}</p>
              </div>
            </div>
            <p className="vigencia__paso">{siguientePaso(doc, estado, gestionado, cmc)}</p>
            {doc.estadoManual && doc.motivoEstado && (
              <p className="vigencia__motivo">
                <strong>Motivo:</strong> {doc.motivoEstado}
                {doc.limiteSubsanacion && <> · Subsanar antes del <strong>{fmt(doc.limiteSubsanacion)}</strong></>}
              </p>
            )}
            {posHoy !== null && (
              <div className="vigencia__linea" aria-hidden="true">
                <div className="vigencia__barra"><span style={{ width: `${posHoy}%` }} /></div>
                {posAviso !== null && <span className="vigencia__marca vigencia__marca--aviso" style={{ left: `${posAviso}%` }} title={`Aviso: ${fmt(doc.fechaAviso)}`} />}
                <span className="vigencia__marca vigencia__marca--hoy" style={{ left: `${posHoy}%` }}><span>Hoy</span></span>
              </div>
            )}
            <dl className="vigencia__fechas">
              <div><dt>Emisión</dt><dd>{fmt(doc.fechaEmision)}</dd></div>
              <div><dt>Aviso</dt><dd>{fmt(doc.fechaAviso)}</dd></div>
              <div><dt>Caducidad</dt><dd>{doc.fechaCaducidad ? fmt(doc.fechaCaducidad) : 'Indefinido'}</dd></div>
            </dl>
          </section>

          <section className="card stack">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 className="ficha__h2">Archivo vigente</h2>
              {vigente && <span className="small muted">{vigente.relacion} · {tamano(vigente.filesize)} · {fmt(vigente.createdAt)}</span>}
            </div>
            {vigente ? (
              <>
                <p className="small" style={{ overflowWrap: 'anywhere' }}><Icon name="file" size={14} /> {vigente.filename}</p>
                {vigente.url && <VisorArchivo url={vigente.url} nombre={vigente.filename ?? 'documento'} mime={vigente.mimeType} />}
              </>
            ) : (
              <div className="vacio" style={{ padding: 'var(--space-8) var(--space-4)' }}>
                <Icon name="file" size={28} />
                <p>
                  {cmc
                    ? 'Este documento no tiene archivo todavía. Súbalo con «Añadir archivo».'
                    : gestionado
                      ? 'Todavía no hay archivo. CMC lo publicará aquí en cuanto lo tenga.'
                      : 'Todavía no hay archivo. Si lo tiene, envíelo a CMC con el botón de arriba.'}
                </p>
              </div>
            )}
          </section>

          <section className="card stack">
            <h2 className="ficha__h2">Datos</h2>
            <dl className="dl">
              <div><dt>Empresa</dt><dd>{empresa.razonSocial}</dd></div>
              <div><dt>Instalación</dt><dd>{categoria?.nombre}</dd></div>
              <div><dt>Referencia</dt><dd>{doc.referencia || '—'}</dd></div>
              <div><dt>Organismo emisor</dt><dd>{doc.organismo || '—'}</dd></div>
              <div><dt>Renovación</dt><dd>{gestionado ? 'Gestionada por CMC' : cmc ? 'La gestiona el cliente' : 'La gestiona usted'}</dd></div>
              <div><dt>Aviso con</dt><dd>{mesesAviso} {mesesAviso === 1 ? 'mes' : 'meses'} de antelación</dd></div>
              {tecnico && <div><dt>Técnico de CMC</dt><dd>{tecnico.nombre}</dd></div>}
            </dl>
            {doc.observaciones && <p className="small"><strong>Observaciones:</strong> {doc.observaciones}</p>}
          </section>
        </div>

        <aside className="ficha__lateral">
          <section className="card stack" style={{ gap: 12 }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h2 className="ficha__h2">Conversaciones</h2>
              {hilos.length > 0 && <a className="small" href={`/api/comunicaciones/${empresa.id}?documento=${doc.id}`}>Exportar</a>}
            </div>
            {hilos.length === 0 && <p className="small muted">Ninguna sobre este documento.</p>}
            <ul className="lista-hilos">
              {hilos.map((h) => (
                <li key={h.id}>
                  <Link href={`/portal/mensajes/${h.id}`}>
                    <span className="lista-hilos__asunto">{h.asunto}</span>
                    <span className="row small" style={{ gap: 8 }}>
                      <span className={`status status--${h.estado === 'resuelto' ? 'verde' : 'naranja'}`}>{h.estado === 'resuelto' ? 'Resuelta' : 'Abierta'}</span>
                      <span className="muted">{fmtHora(h.ultimoMensaje)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link className="btn btn--ghost btn--sm" href={`/portal/mensajes/nuevo?empresa=${empresa.id}&documento=${doc.id}`}><Icon name="chat" />Nueva conversación</Link>
          </section>

          <section className="card stack" style={{ gap: 12 }}>
            <h2 className="ficha__h2">Histórico de archivos</h2>
            <ol className="timeline">
              {archivos.length === 0 && <li className="muted small">Sin archivos todavía.</li>}
              {archivos.map((a: Archivo) => {
                const esVigente = a.id === vigente?.id
                return (
                  <li key={a.id} className={esVigente ? 'timeline--vigente' : a.historico ? 'timeline--pasado' : undefined}>
                    <span className={`dot${a.historico ? ' dot--azul' : ''}`} aria-hidden="true" />
                    <div className="stack" style={{ gap: 0 }}>
                      <strong>{a.relacion}{a.historico ? ' · Histórico' : esVigente ? ' · Vigente' : ''}</strong>
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
