import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdjuntoARevision } from '@/components/AdjuntoARevision'
import { Actualizar } from '@/components/comunicacion/Actualizar'
import { Bandeja, consultaFiltros, type FiltrosComunicacion } from '@/components/comunicacion/Bandeja'
import { GestionConversacion } from '@/components/comunicacion/GestionConversacion'
import { ScrollAlFinal } from '@/components/comunicacion/ScrollAlFinal'
import { Icon } from '@/components/Icon'
import { MensajeForm } from '@/components/MensajeForm'
import { tamano } from '@/lib/subidas'
import { hiloPorId, mensajesDeHilo, usuariosCms } from '@/datos/consultas'
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

  const empresa = hilo.empresa as Empresa
  const doc = typeof hilo.documento === 'object' && hilo.documento ? hilo.documento : null
  const categoria = !doc && typeof hilo.categoria === 'object' && hilo.categoria ? hilo.categoria : null
  const [mensajes, tecnicos] = await Promise.all([mensajesDeHilo(hilo.id), cmc ? usuariosCms() : null])
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
            {categoria && <> · Categoría {categoria.nombre}</>}
          </p>
          <div className="row small" style={{ gap: 8 }}>
            <span className={`status status--${resuelta ? 'verde' : 'naranja'}`}>{resuelta ? 'Resuelta' : 'Abierta'}</span>
            {!cmc && <span className="muted">{asignado ? `La atiende ${asignado} (CMC)` : 'Pendiente de asignar en CMC'}</span>}
          </div>
        </div>
        <a className="btn btn--ghost btn--sm" href={`/api/comunicaciones/${empresa.id}${doc ? `?documento=${doc.id}` : ''}`} title={doc ? 'Historial de comunicaciones de este documento' : `Historial de comunicaciones de ${empresa.razonSocial}`}>
          <Icon name="download" />Exportar PDF
        </a>
      </header>

      {cmc && tecnicos && <GestionConversacion key={`${hilo.estado}-${idDe(hilo.asignado)}`} hilo={String(hilo.id)} estado={resuelta ? 'resuelto' : 'abierto'} asignado={idDe(hilo.asignado)} tecnicos={tecnicos} />}

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
