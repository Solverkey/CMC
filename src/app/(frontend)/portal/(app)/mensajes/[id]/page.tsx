import { Enlace as Link } from '@/components/Enlace'
import { notFound } from 'next/navigation'
import { AdjuntoConversacion } from '@/components/comunicacion/AdjuntoConversacion'
import { Actualizar } from '@/components/comunicacion/Actualizar'
import { Bandeja, consultaFiltros, type FiltrosComunicacion } from '@/components/comunicacion/Bandeja'
import { GestionConversacion } from '@/components/comunicacion/GestionConversacion'
import { ScrollAlFinal } from '@/components/comunicacion/ScrollAlFinal'
import { Icon } from '@/components/Icon'
import { MensajeForm } from '@/components/MensajeForm'
import { tamano } from '@/lib/subidas'
import { destinosDeAdjuntos } from '@/datos/adjuntos'
import { hiloPorId, listarDocumentos, marcarLeido, mensajesDeHilo, usuariosCms } from '@/datos/consultas'
import type { Adjunto, Empresa, User } from '@/datos/tipos'
import { contexto, idDe } from '@/lib/payload'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user } = await contexto(`/portal/mensajes/${id}`)
  const hilo = await hiloPorId(id, user)
  return { title: hilo ? `${hilo.asunto} · Comunicación` : 'Comunicación' }
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' })
const dia = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export default async function ConversacionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<FiltrosComunicacion> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const { user, cmc } = await contexto(`/portal/mensajes/${id}`)
  const hilo = await hiloPorId(id, user)
  if (!hilo) notFound()
  // Abrirla la marca como leída (antes de pintar la bandeja, para que la lista ya salga al día).
  await marcarLeido(hilo.id, user.id)

  const empresa = hilo.empresa as Empresa
  const doc = typeof hilo.documento === 'object' && hilo.documento ? hilo.documento : null
  const categoria = !doc && typeof hilo.categoria === 'object' && hilo.categoria ? hilo.categoria : null
  const [mensajes, tecnicos, docsEmpresa] = await Promise.all([
    mensajesDeHilo(hilo.id),
    cmc ? usuariosCms() : null,
    cmc ? listarDocumentos(user, 'AND empresa_id = $1 ORDER BY titulo', [empresa.id]) : [],
  ])
  // Todos los archivos de la conversación y qué se ha hecho con cada uno (enviado a revisión, añadido a un documento).
  const archivos = mensajes.flatMap((m) => (m.adjuntos ?? []).filter((a): a is Adjunto => typeof a === 'object' && a !== null).map((a) => ({ adjunto: a, mensaje: m })))
  const destinos = await destinosDeAdjuntos(archivos.map((x) => x.adjunto.id))
  const documentos = docsEmpresa.map((d) => ({ id: String(d.id), titulo: d.titulo }))
  const documentoConversacion = doc ? String(doc.id) : undefined
  const tarjeta = (adj: Adjunto, compacto?: boolean) => (
    <AdjuntoConversacion
      key={adj.id}
      adjunto={{ id: Number(adj.id), filename: adj.filename ?? 'archivo', url: adj.url ?? null, tamano: tamano(adj.filesize) }}
      destino={destinos.get(Number(adj.id))}
      cmc={cmc}
      documentos={documentos}
      documentoConversacion={documentoConversacion}
      compacto={compacto}
    />
  )
  const pendientes = archivos.filter((x) => !destinos.get(Number(x.adjunto.id))?.archivo).length
  const resuelta = hilo.estado === 'resuelto'
  const asignado = (hilo.asignado as User | null)?.nombre

  // Separador de día delante del primer mensaje de cada día.
  const dias = mensajes.map((m) => dia(m.createdAt))
  return (
    <Bandeja user={user} cmc={cmc} sp={sp} activo={String(hilo.id)}>
      <Actualizar />
      <header className="conv__cabeza">
        <div className="stack" style={{ gap: 4, minWidth: 0, flex: '1 1 320px' }}>
          <Link className="conv__volver small" href={`/portal/mensajes${consultaFiltros(sp)}`}>← Conversaciones</Link>
          <h2>{hilo.asunto}</h2>
          <p className="small muted">
            {empresa.razonSocial}
            {doc && <> · Sobre <Link href={`/portal/documentos/${doc.id}`}>{doc.titulo}</Link></>}
            {categoria && <> · Instalación {categoria.nombre}</>}
          </p>
          <div className="row small" style={{ gap: 8 }}>
            <span className={`status status--${resuelta ? 'verde' : 'naranja'}`}>{resuelta ? 'Resuelta' : 'Abierta'}</span>
            {!cmc && <span className="muted">{asignado ? `La atiende ${asignado} (CMC)` : 'Pendiente de asignar en CMC'}</span>}
          </div>
        </div>
        {archivos.length > 0 && (
          <details className="conv__archivos">
            <summary className="btn btn--ghost btn--sm">
              <Icon name="paperclip" />Archivos ({archivos.length}){cmc && pendientes > 0 ? <span className="insignia" title="Sin añadir a un documento">{pendientes} sin archivar</span> : null}
            </summary>
            <div className="conv__archivos__caja">
              <p className="small muted" style={{ margin: 0 }}>
                {cmc ? 'Añada cada archivo al documento que corresponda; quedará en su histórico.' : 'Archivos compartidos en esta conversación y en qué ha quedado cada uno.'}
              </p>
              {archivos.map((x) => tarjeta(x.adjunto, true))}
            </div>
          </details>
        )}
        <a className="btn btn--ghost btn--sm" href={`/api/comunicaciones/${empresa.id}${doc ? `?documento=${doc.id}` : ''}`} title={doc ? 'Historial de comunicaciones de este documento' : `Historial de comunicaciones de ${empresa.razonSocial}`}>
          <Icon name="download" />Exportar PDF
        </a>
      </header>

      {cmc && tecnicos && <GestionConversacion key={`${hilo.estado}-${idDe(hilo.asignado)}-${doc?.id ?? ''}`} hilo={String(hilo.id)} estado={resuelta ? 'resuelto' : 'abierto'} asignado={idDe(hilo.asignado)} tecnicos={tecnicos} documentos={documentos} documento={documentoConversacion ?? ''} />}

      <div className="conv__mensajes" aria-live="polite">
        {mensajes.length === 0 && <p className="muted small" style={{ textAlign: 'center' }}>Esta conversación aún no tiene mensajes.</p>}
        {mensajes.map((m, i) => {
          const autor = m.autor as User | null
          const deCmc = autor?.rol === 'superadmin'
          // Mis mensajes (o los de mi lado: CMC o mi empresa) van a la derecha, como en un chat.
          const mia = cmc ? deCmc : !deCmc
          const hoy = dias[i]
          const separador = i === 0 || hoy !== dias[i - 1]
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {separador && <p className="conv__dia">{hoy}</p>}
              <article className={`burbuja${mia ? ' burbuja--mia' : ''}`} aria-label={`Mensaje de ${autor?.nombre ?? 'Usuario'}`}>
                <header className="burbuja__autor">
                  <strong>{String(autor?.id) === String(user.id) ? 'Usted' : (autor?.nombre ?? 'Usuario')}{deCmc ? ' · CMC' : ''}</strong>
                  <time dateTime={m.createdAt}>{hora(m.createdAt)}</time>
                </header>
                <p className="burbuja__texto">{m.texto}</p>
                {(m.adjuntos ?? []).map((a) => (typeof a === 'object' && a ? tarjeta(a as Adjunto) : null))}
              </article>
            </div>
          )
        })}
        <ScrollAlFinal marca={mensajes.length} />
      </div>

      <div className="conv__redactar">
        <MensajeForm empresaId={String(empresa.id)} hiloId={String(hilo.id)} />
        {resuelta && !cmc && <p className="hint" style={{ marginTop: 8 }}>La conversación está resuelta. Si responde, se volverá a abrir.</p>}
      </div>
    </Bandeja>
  )
}
