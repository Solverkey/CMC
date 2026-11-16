import type { PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import type { Adjunto, Empresa, Hilo, Mensaje, User } from '@/payload-types'
import { puedeVerEmpresa } from '../access'
import { registrar } from '../lib/actividad'
import { leerFichero } from '../lib/ficheros'
import { crearPdf } from '../lib/pdf'

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string))

type Fichero = { data: Buffer; name: string; mimetype: string; size: number }

const comoUsuario = (req: PayloadRequest) => ({ user: req.user, overrideAccess: false as const, req })

export async function subirAdjunto(req: PayloadRequest, empresa: string | number, fichero: Fichero) {
  return (await req.payload.create({ collection: 'adjuntos', data: { empresa: Number(empresa) }, file: fichero, ...comoUsuario(req) })) as Adjunto
}

export async function crearHilo(req: PayloadRequest, d: { empresa: string | number; asunto: string; texto: string; documento?: string | number | null; categoria?: string | number | null; adjuntos?: (string | number)[] }) {
  if (!d.asunto?.trim()) throw new APIError('Indique el asunto.', 400, null, true)
  const hilo = (await req.payload.create({
    collection: 'hilos',
    data: { empresa: Number(d.empresa), asunto: d.asunto.trim(), documento: d.documento ? Number(d.documento) : undefined, categoria: d.categoria ? Number(d.categoria) : undefined },
    ...comoUsuario(req),
  })) as Hilo
  await escribirMensaje(req, { hilo: hilo.id, texto: d.texto, adjuntos: d.adjuntos })
  return hilo
}

export async function escribirMensaje(req: PayloadRequest, d: { hilo: string | number; texto: string; adjuntos?: (string | number)[] }) {
  return (await req.payload.create({ collection: 'mensajes', data: { hilo: Number(d.hilo), texto: d.texto, adjuntos: (d.adjuntos ?? []).map(Number) }, ...comoUsuario(req) })) as Mensaje
}

/** Un adjunto de un mensaje se convierte en un documento enviado a CMC para su revisión. */
export async function adjuntoAEnvio(req: PayloadRequest, d: { adjunto: string | number; titulo?: string; documentoRelacionado?: string | number | null; relacion?: string; nuevaCaducidad?: string | null }) {
  const adj = (await req.payload.findByID({ collection: 'adjuntos', id: d.adjunto, depth: 0, ...comoUsuario(req) })) as Adjunto
  const data = await leerFichero(req.payload, 'adjuntos', adj)
  return req.payload.create({
    collection: 'envios',
    data: {
      titulo: d.titulo?.trim() || adj.filename!,
      empresa: idDe(adj.empresa) as number,
      documentoRelacionado: d.documentoRelacionado ? Number(d.documentoRelacionado) : undefined,
      relacion: d.relacion || (d.documentoRelacionado ? 'Renovación' : 'Original'),
      nuevaCaducidad: d.nuevaCaducidad || undefined,
      comentario: 'Enviado desde un adjunto de la comunicación con CMC',
    },
    file: { data, name: adj.filename!, mimetype: adj.mimeType ?? 'application/octet-stream', size: data.length },
    context: { sinComprimir: true },
    ...comoUsuario(req),
  })
}

/** Historial de comunicaciones de una empresa o de un documento, en PDF. */
export async function exportarHistorial(req: PayloadRequest, d: { empresa: string | number; documento?: string | number | null }) {
  if (!puedeVerEmpresa(req.user, d.empresa)) throw new APIError('No tiene acceso a esa empresa.', 403, null, true)
  const empresa = (await req.payload.findByID({ collection: 'empresas', id: d.empresa, depth: 0, ...comoUsuario(req) })) as Empresa
  const where: Where = { and: [{ empresa: { equals: empresa.id } }, ...(d.documento ? [{ documento: { equals: d.documento } }] : [])] }
  const hilos = await req.payload.find({ collection: 'hilos', where, depth: 1, limit: 1000, sort: 'createdAt', ...comoUsuario(req) })
  const pdf = await crearPdf(`Comunicaciones · ${empresa.razonSocial}`, `${d.documento ? 'Documento ' + d.documento + ' · ' : ''}${hilos.totalDocs} conversaciones · generado el ${new Date().toLocaleString('es-ES')}`)
  for (const h of hilos.docs as Hilo[]) {
    pdf.bloque(`CONVERSACIÓN · ${h.estado === 'resuelto' ? 'RESUELTA' : 'ABIERTA'}${h.asignado && typeof h.asignado === 'object' ? ` · ASIGNADA A ${(h.asignado as User).nombre}` : ''}`, h.asunto)
    const msgs = await req.payload.find({ collection: 'mensajes', where: { hilo: { equals: h.id } }, depth: 1, limit: 2000, sort: 'createdAt', ...comoUsuario(req) })
    for (const m of msgs.docs as Mensaje[]) {
      const autor = m.autor && typeof m.autor === 'object' ? `${(m.autor as User).nombre} <${(m.autor as User).email}>` : 'Usuario'
      const adjuntos = (m.adjuntos ?? []).map((a) => (typeof a === 'object' ? a.filename : a)).filter(Boolean)
      pdf.bloque(`${new Date(m.createdAt).toLocaleString('es-ES')} · ${autor}`, m.texto + (adjuntos.length ? `\nAdjuntos: ${adjuntos.join(', ')}` : ''))
    }
  }
  await registrar(req, { accion: 'exportacion', descripcion: `Exportación del historial de comunicaciones de «${empresa.razonSocial}»`, empresa: empresa.id, coleccion: 'hilos' })
  return { data: await pdf.guardar(), nombre: `Comunicaciones ${empresa.razonSocial.replace(/[\\/:*?"<>|]+/g, '-')}.pdf`, mime: 'application/pdf' }
}
