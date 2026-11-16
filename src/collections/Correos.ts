import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { empresasDe, isSuperAdmin, nadie } from '../access'
import { registrar } from '../lib/actividad'
import { firmar, igualSeguro } from '../lib/cifrado'

const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64')

const ESTADOS_EVENTO: Record<string, 'entregado' | 'abierto' | 'rebotado' | 'error'> = {
  delivered: 'entregado',
  'email.delivered': 'entregado',
  entregado: 'entregado',
  opened: 'abierto',
  'email.opened': 'abierto',
  abierto: 'abierto',
  bounced: 'rebotado',
  bounce: 'rebotado',
  'email.bounced': 'rebotado',
  rebotado: 'rebotado',
  complained: 'rebotado',
  'email.complained': 'rebotado',
  failed: 'error',
  dropped: 'error',
}

async function marcar(req: PayloadRequest, correo: { id: number | string; asunto: string; para: string; empresa?: unknown; estado?: string | null }, evento: 'entregado' | 'abierto' | 'rebotado' | 'error') {
  const orden = ['pendiente', 'enviado', 'entregado', 'abierto']
  const actual = correo.estado ?? 'pendiente'
  const avanza = evento === 'rebotado' || evento === 'error' || orden.indexOf(evento) > orden.indexOf(actual)
  const campo = { entregado: 'entregadoEn', abierto: 'abiertoEn', rebotado: 'reboteEn', error: 'reboteEn' }[evento]
  await req.payload.update({
    collection: 'correos',
    id: correo.id,
    overrideAccess: true,
    req,
    data: { ...(avanza ? { estado: evento } : {}), [campo]: new Date().toISOString() },
  })
  await registrar(req, {
    accion: ({ entregado: 'correo_entregado', abierto: 'correo_abierto', rebotado: 'correo_rebotado', error: 'correo_error' } as const)[evento],
    descripcion: `Correo «${correo.asunto}» a ${correo.para}: ${evento}`,
    empresa: correo.empresa as number,
    coleccion: 'correos',
    registroId: correo.id,
  })
}

/** Registro de cada correo enviado: entrega, apertura y rebotes (informe, apartado 6). */
export const Correos: CollectionConfig = {
  slug: 'correos',
  labels: { singular: 'Correo', plural: 'Correos enviados' },
  admin: { useAsTitle: 'asunto', defaultColumns: ['asunto', 'para', 'estado', 'createdAt'], group: 'Plataforma' },
  access: {
    // El cliente ve en su centro de notificaciones los avisos dirigidos a su empresa, no los internos de CMC.
    read: ({ req }): Where | boolean => {
      if (!req.user) return false
      if (isSuperAdmin(req)) return true
      const ids = empresasDe(req.user)
      return ids.length ? { and: [{ empresa: { in: ids } }, { destinatario: { equals: 'cliente' } }] } : false
    },
    create: nadie,
    update: nadie,
    delete: nadie,
  },
  endpoints: [
    {
      // Píxel de apertura incluido en cada correo.
      path: '/:id/abierto',
      method: 'get',
      handler: async (req) => {
        const id = req.routeParams?.id as string
        const firma = new URL(req.url ?? 'http://x').searchParams.get('f') ?? ''
        if (igualSeguro(firma, firmar(String(id), 'pixel'))) {
          const correo = await req.payload.findByID({ collection: 'correos', id, overrideAccess: true, depth: 0, req }).catch(() => null)
          if (correo && !correo.abiertoEn) await marcar(req, correo, 'abierto')
        }
        return new Response(PIXEL, { headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' } })
      },
    },
    {
      // Webhook del proveedor de correo transaccional: entrega, apertura y rebotes.
      // Acepta { messageId, evento } o el formato de Resend/Postmark ({ type, data: { email_id } }).
      path: '/eventos',
      method: 'post',
      handler: async (req) => {
        const secreto = process.env.EMAIL_WEBHOOK_SECRET
        const recibido = req.headers.get('x-webhook-secret') ?? new URL(req.url ?? 'http://x').searchParams.get('secreto') ?? ''
        if (!secreto || !igualSeguro(recibido, secreto)) return Response.json({ error: 'No autorizado' }, { status: 401 })
        const body = (await req.json?.().catch(() => null)) as Record<string, any> | null
        const eventos = Array.isArray(body) ? body : [body]
        let procesados = 0
        for (const ev of eventos) {
          if (!ev) continue
          const tipo = String(ev.evento ?? ev.type ?? ev.RecordType ?? ev.event ?? '').toLowerCase()
          const messageId = String(ev.messageId ?? ev.data?.email_id ?? ev.MessageID ?? ev['smtp-id'] ?? '').replace(/[<>]/g, '')
          const estado = ESTADOS_EVENTO[tipo]
          if (!estado || !messageId) continue
          const { docs } = await req.payload.find({ collection: 'correos', where: { messageId: { equals: messageId } }, limit: 1, depth: 0, overrideAccess: true, req })
          if (docs[0]) {
            await marcar(req, docs[0], estado)
            procesados++
          }
        }
        return Response.json({ procesados })
      },
    },
  ],
  fields: [
    { name: 'asunto', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'para', type: 'email', required: true, index: true },
        { name: 'usuario', type: 'relationship', relationTo: 'users' },
        {
          name: 'destinatario',
          type: 'select',
          defaultValue: 'cliente',
          options: [
            { label: 'Cliente', value: 'cliente' },
            { label: 'CMC', value: 'cmc' },
          ],
        },
      ],
    },
    {
      name: 'estado',
      type: 'select',
      index: true,
      defaultValue: 'pendiente',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Pendiente', value: 'pendiente' },
        { label: 'Enviado', value: 'enviado' },
        { label: 'Entregado', value: 'entregado' },
        { label: 'Abierto', value: 'abierto' },
        { label: 'Rebotado', value: 'rebotado' },
        { label: 'Error', value: 'error' },
      ],
    },
    { name: 'plantilla', type: 'text', index: true },
    { name: 'texto', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'empresa', type: 'relationship', relationTo: 'empresas', index: true },
        { name: 'documento', type: 'relationship', relationTo: 'documentos' },
        { name: 'hilo', type: 'relationship', relationTo: 'hilos' },
      ],
    },
    { name: 'idempotencia', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'messageId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'error', type: 'textarea', admin: { readOnly: true } },
    { name: 'enviadoEn', type: 'date', admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'entregadoEn', type: 'date', admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'abiertoEn', type: 'date', admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'reboteEn', type: 'date', admin: { position: 'sidebar', readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
  ],
}
