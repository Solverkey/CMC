'use server'

import { headers } from 'next/headers'
import { createLocalReq, type PayloadRequest } from 'payload'
import { z } from 'zod'
import { registrar } from '@/lib/actividad'
import { leerTokenFormulario } from '@/lib/consultas'
import { programarCorreo } from '@/lib/correo'
import { urlServidor } from '@/lib/configuracion'
import { destinatariosCMC } from '@/lib/destinatarios'
import { payloadClient } from '@/lib/payload'
import { leerWeb } from '@/lib/web'

export type EstadoConsulta = { ok?: boolean; error?: string; errores?: Record<string, string>; valores?: Record<string, string> } | null

const MAX_POR_HORA = 5
const SEGUNDOS_MINIMOS = 3

const esquema = z.object({
  nombre: z.string().trim().min(2, 'Indique su nombre.').max(120),
  empresa: z.string().trim().max(160).optional().default(''),
  email: z.string().trim().toLowerCase().email('Indique un correo electrónico válido.').max(200),
  telefono: z
    .string()
    .trim()
    .max(30)
    .regex(/^[0-9+()\s.-]*$/, 'El teléfono solo puede tener números.')
    .optional()
    .default(''),
  servicio: z.string().trim().max(160).optional().default(''),
  mensaje: z.string().trim().min(10, 'Cuéntenos algo más sobre su consulta.').max(5000, 'El mensaje es demasiado largo (máximo 5.000 caracteres).'),
  privacidad: z.literal('on', { message: 'Debe aceptar la política de privacidad.' }),
})

export async function enviarConsulta(_: EstadoConsulta, f: FormData): Promise<EstadoConsulta> {
  const valores = Object.fromEntries(['nombre', 'empresa', 'email', 'telefono', 'servicio', 'mensaje'].map((k) => [k, String(f.get(k) ?? '')]))

  // Campo trampa invisible: si viene relleno es un robot. Se responde como si todo hubiera ido bien.
  if (String(f.get('web') ?? '')) return { ok: true }
  const token = leerTokenFormulario(String(f.get('token') ?? ''))
  if (!token) return { error: 'El formulario ha caducado. Recargue la página e inténtelo de nuevo.', valores }
  if (Date.now() - token.t < SEGUNDOS_MINIMOS * 1000) return { ok: true }

  const datos = esquema.safeParse(Object.fromEntries(f))
  if (!datos.success) {
    const errores: Record<string, string> = {}
    for (const i of datos.error.issues) errores[String(i.path[0])] ??= i.message
    return { error: 'Revise los campos marcados.', errores, valores }
  }
  const d = datos.data

  const payload = await payloadClient()
  const h = await headers()
  const req = await createLocalReq({ req: { headers: new Headers(h) } as Partial<PayloadRequest> }, payload)
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'desconocida'

  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recientes = await payload.count({ collection: 'consultas', where: { and: [{ ip: { equals: ip } }, { createdAt: { greater_than: haceUnaHora } }] }, overrideAccess: true })
  if (recientes.totalDocs >= MAX_POR_HORA) return { error: 'Hemos recibido varias consultas desde su conexión. Inténtelo más tarde o escríbanos por correo electrónico.', valores }

  const consulta = await payload.create({
    collection: 'consultas',
    overrideAccess: true,
    req,
    data: { nombre: d.nombre, empresa: d.empresa, email: d.email, telefono: d.telefono, servicio: d.servicio, mensaje: d.mensaje, aceptaPrivacidad: true, ip, estado: 'nueva' },
  })
  await registrar(req, { accion: 'consulta', descripcion: `Consulta desde la web de ${d.nombre}${d.empresa ? ` (${d.empresa})` : ''}`, coleccion: 'consultas', registroId: consulta.id })

  const web = await leerWeb(payload)
  const para = web.emailsConsultas.length ? web.emailsConsultas.map((email) => ({ email, tipo: 'cmc' as const })) : await destinatariosCMC(req)
  await programarCorreo(req, {
    plantilla: 'consulta_web',
    para,
    vars: { nombre: d.nombre, empresa: d.empresa || 'sin empresa', email: d.email, telefono: d.telefono || '—', servicio: d.servicio || '—', mensaje: d.mensaje },
    enlace: `${urlServidor()}/admin/collections/consultas/${consulta.id}`,
    responderA: d.email,
  })

  return { ok: true }
}
