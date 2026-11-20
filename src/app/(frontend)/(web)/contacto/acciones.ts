'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { registrar } from '@/lib/actividad'
import { leerTokenFormulario } from '@/lib/consultas'
import { programarCorreo } from '@/lib/correo'
import { urlServidor } from '@/lib/configuracion'
import { destinatariosCMC } from '@/lib/destinatarios'
import { contar } from '@/datos/consultas'
import { ahora, bit, ejecutar } from '@/lib/db'
import { leerWeb } from '@/lib/web'
import type { Ctx } from '@/lib/ctx'

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

  const h = await headers()
  const req: Ctx = { user: null, headers: h, origen: 'web', context: {} }
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'desconocida'

  const haceUnaHora = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const recientes = await contar('consultas', 'ip = $1 AND created_at > $2', [ip, haceUnaHora])
  if (recientes >= MAX_POR_HORA) return { error: 'Hemos recibido varias consultas desde su conexión. Inténtelo más tarde o escríbanos por correo electrónico.', valores }

  await ejecutar(
    `INSERT INTO consultas (nombre, empresa, email, telefono, servicio, mensaje, acepta_privacidad, ip, estado, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'nueva',$9,$9)`,
    [d.nombre, d.empresa || null, d.email, d.telefono || null, d.servicio || null, d.mensaje, bit(true), ip, ahora()],
  )
  await registrar(req, { accion: 'consulta', descripcion: `Consulta desde la web de ${d.nombre}${d.empresa ? ` (${d.empresa})` : ''}`, coleccion: 'consultas' })

  const web = await leerWeb()
  const para = web.emailsConsultas.length ? web.emailsConsultas.map((email) => ({ email, tipo: 'cmc' as const })) : await destinatariosCMC(req)
  await programarCorreo(req, {
    plantilla: 'consulta_web',
    para,
    vars: { nombre: d.nombre, empresa: d.empresa || 'sin empresa', email: d.email, telefono: d.telefono || '—', servicio: d.servicio || '—', mensaje: d.mensaje },
    enlace: `${urlServidor()}/contacto`,
    responderA: d.email,
  })

  return { ok: true }
}
