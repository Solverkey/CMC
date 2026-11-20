import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { FormAccion } from '@/components/FormAccion'
import { VisorArchivo } from '@/components/VisorArchivo'
import { resolverEnvio } from '@/app/(frontend)/portal/acciones'
import { contexto, fmt, idDe } from '@/lib/payload'
import type { Documento, Empresa } from '@/payload-types'

export const metadata = { title: 'Revisar envío' }

const dia = (v?: string | null) => (v ? v.slice(0, 10) : '')

export default async function RevisarEnvio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { payload, user, cmc } = await contexto(`/portal/enviar/${id}`)
  if (!cmc) redirect('/portal/enviar')
  const envio = await payload.findByID({ collection: 'envios', id, user, overrideAccess: false, depth: 1 }).catch(() => null)
  if (!envio) notFound()
  const empresaId = String(idDe(envio.empresa))
  const [categorias, documentos] = await Promise.all([
    payload.find({ collection: 'categorias', where: { and: [{ empresa: { equals: empresaId } }, { archivada: { not_equals: true } }] }, depth: 0, limit: 200, sort: 'orden', overrideAccess: true }),
    payload.find({ collection: 'documentos', where: { empresa: { equals: empresaId } }, depth: 0, limit: 500, sort: 'titulo', overrideAccess: true }),
  ])
  const empresa = envio.empresa as Empresa
  const relacionado = envio.documentoRelacionado as Documento | null

  return (
    <>
      <Link href="/portal/enviar" className="small">← Bandeja de envíos</Link>
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{empresa?.razonSocial}</p>
        <h1>{envio.titulo}</h1>
        <p className="muted">
          {envio.relacion}
          {relacionado && typeof relacionado === 'object' ? ` de «${relacionado.titulo}»` : ''}
          {envio.nuevaCaducidad ? ` · caducidad propuesta ${fmt(envio.nuevaCaducidad)}` : ''}
        </p>
        {envio.comentario && <p>{envio.comentario}</p>}
      </div>

      <div className={envio.url ? 'revision' : 'stack'}>
      <div className="stack">
      {!envio.url && <p className="muted">Este envío no tiene archivo.</p>}
      {envio.estado !== 'pendiente' ? (
        <p className="alert">Este envío ya está {envio.estado}.{envio.motivoRechazo ? ` Motivo: ${envio.motivoRechazo}` : ''}</p>
      ) : (
        <FormAccion accion={resolverEnvio} className="card stack" style={{ gap: 16 }}>
          <input type="hidden" name="id" value={envio.id} />
          <div className="field">
            <label htmlFor="documentoDestino">Publicar en un documento existente</label>
            <select className="input" id="documentoDestino" name="documentoDestino" defaultValue={relacionado && typeof relacionado === 'object' ? String(relacionado.id) : ''}>
              <option value="">Crear un documento nuevo</option>
              {documentos.docs.map((d) => <option key={d.id} value={d.id}>{d.titulo}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="categoriaDestino">Categoría, si es nuevo</label>
            <select className="input" id="categoriaDestino" name="categoriaDestino">
              <option value="">Elegir</option>
              {categorias.docs.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="row">
            <div className="field" style={{ flex: '1 1 140px' }}><label htmlFor="tituloFinal">Nombre definitivo</label><input className="input" id="tituloFinal" name="tituloFinal" defaultValue={envio.titulo} /></div>
            <div className="field" style={{ flex: '1 1 120px' }}><label htmlFor="relacionFinal">Tipo de relación</label><input className="input" id="relacionFinal" name="relacionFinal" defaultValue={envio.relacion ?? 'Renovación'} /></div>
          </div>
          <div className="row">
            <div className="field" style={{ flex: '1 1 0' }}><label htmlFor="fechaEmision">Emisión</label><input className="input" id="fechaEmision" name="fechaEmision" type="date" /></div>
            <div className="field" style={{ flex: '1 1 0' }}><label htmlFor="fechaCaducidad">Caducidad</label><input className="input" id="fechaCaducidad" name="fechaCaducidad" type="date" defaultValue={dia(envio.nuevaCaducidad)} /></div>
            <div className="field" style={{ flex: '1 1 0' }}><label htmlFor="fechaAviso">Aviso</label><input className="input" id="fechaAviso" name="fechaAviso" type="date" /></div>
          </div>
          <div className="field"><label htmlFor="motivoRechazo">Motivo, si lo rechaza</label><textarea className="input" id="motivoRechazo" name="motivoRechazo" rows={2} /></div>
          <div className="row">
            <button className="btn btn--primary" type="submit" name="decision" value="publicado">Publicar</button>
            <button className="btn btn--secondary" type="submit" name="decision" value="rechazado">Rechazar</button>
          </div>
        </FormAccion>
      )}
      </div>
      {envio.url && (
        <aside className="revision__archivo stack">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Archivo</h2>
            <a className="btn btn--secondary btn--sm" href={envio.url} download={envio.filename ?? undefined}>Descargar</a>
          </div>
          <VisorArchivo url={envio.url} nombre={envio.filename ?? envio.titulo} mime={envio.mimeType} />
        </aside>
      )}
      </div>
    </>
  )
}
