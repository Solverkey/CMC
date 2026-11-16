import type { TaskConfig } from 'payload'
import { registrar } from '../lib/actividad'

/** Envío real de un correo programado. Si el proveedor falla, la cola lo reintenta. */
export const enviarCorreo: TaskConfig<'enviarCorreo'> = {
  slug: 'enviarCorreo',
  retries: 4,
  inputSchema: [
    { name: 'correo', type: 'text', required: true },
    { name: 'html', type: 'textarea', required: true },
    { name: 'desde', type: 'text', required: true },
    { name: 'responderA', type: 'text' },
  ],
  handler: async ({ input, req }) => {
    const correo = await req.payload.findByID({ collection: 'correos', id: input.correo, depth: 0, overrideAccess: true, req })
    if (correo.estado !== 'pendiente' && correo.estado !== 'error') return { output: {} }
    try {
      const res = (await req.payload.sendEmail({
        from: input.desde,
        to: correo.para,
        subject: correo.asunto,
        html: input.html,
        ...(input.responderA ? { replyTo: input.responderA } : {}),
      })) as { messageId?: string } | undefined
      await req.payload.update({
        collection: 'correos',
        id: correo.id,
        overrideAccess: true,
        req,
        data: { estado: 'enviado', enviadoEn: new Date().toISOString(), messageId: res?.messageId?.replace(/[<>]/g, ''), error: null },
      })
      await registrar(req, { accion: 'correo_enviado', descripcion: `Correo «${correo.asunto}» enviado a ${correo.para}`, empresa: correo.empresa as number, coleccion: 'correos', registroId: correo.id })
    } catch (err) {
      await req.payload.update({ collection: 'correos', id: correo.id, overrideAccess: true, req, data: { estado: 'error', error: String((err as Error).message ?? err).slice(0, 500) } })
      await registrar(req, { accion: 'correo_error', descripcion: `Error al enviar «${correo.asunto}» a ${correo.para}`, empresa: correo.empresa as number, coleccion: 'correos', registroId: correo.id })
      throw err
    }
    return { output: {} }
  },
}
