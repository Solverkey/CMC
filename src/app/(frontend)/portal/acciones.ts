'use server'

import { revalidatePath } from 'next/cache'
import { administraEmpresa } from '@/access'
import { contexto, idDe } from '@/lib/payload'
import { COLECCION_CLAVES, crearClave } from '@/mcp/claves'
import type { User } from '@/payload-types'
import { cambiarRol, enviarInvitacion, invitarUsuario, quitarAcceso } from '@/servicios/usuarios'

export type Resultado = { ok?: string; error?: string; clave?: string } | null

const ejecutar = async (ruta: string, fn: () => Promise<string | Resultado>): Promise<Resultado> => {
  try {
    const r = await fn()
    revalidatePath(ruta)
    return typeof r === 'string' ? { ok: r } : r
  } catch (e) {
    return { error: (e as Error).message || 'No se ha podido completar la acción.' }
  }
}

const campo = (f: FormData, k: string) => String(f.get(k) ?? '').trim()

export async function invitar(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  return ejecutar('/portal/usuarios', async () => {
    const r = await invitarUsuario(req, { email: campo(f, 'email'), nombre: campo(f, 'nombre') || undefined, empresa: campo(f, 'empresa'), rol: campo(f, 'rol') === 'admin' ? 'admin' : 'usuario' })
    return r.creado ? `Invitación enviada a ${campo(f, 'email')}.` : `${campo(f, 'email')} ya tenía cuenta: se le ha dado acceso a esta empresa.`
  })
}

export async function quitar(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  return ejecutar('/portal/usuarios', async () => {
    await quitarAcceso(req, { usuario: campo(f, 'usuario'), empresa: campo(f, 'empresa') })
    return 'Acceso retirado.'
  })
}

export async function rol(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  return ejecutar('/portal/usuarios', async () => {
    await cambiarRol(req, { usuario: campo(f, 'usuario'), empresa: campo(f, 'empresa'), rol: campo(f, 'rol') === 'admin' ? 'admin' : 'usuario' })
    return 'Rol actualizado.'
  })
}

export async function reenviar(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  return ejecutar('/portal/usuarios', async () => {
    const empresa = campo(f, 'empresa')
    if (!administraEmpresa(req.user, empresa)) throw new Error('No administra esta empresa.')
    const u = (await req.payload.findByID({ collection: 'users', id: campo(f, 'usuario'), depth: 0, overrideAccess: true, req })) as User
    if (!(u.empresas ?? []).some((m) => idDe(m.empresa) === empresa)) throw new Error('Ese usuario no pertenece a la empresa.')
    const emp = await req.payload.findByID({ collection: 'empresas', id: empresa, depth: 0, overrideAccess: true, req })
    await enviarInvitacion(req, u, emp)
    return `Invitación reenviada a ${u.email}.`
  })
}

export async function gestionarHilo(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  const id = campo(f, 'hilo')
  return ejecutar(`/portal/mensajes/${id}`, async () => {
    const estado = campo(f, 'estado')
    const asignado = campo(f, 'asignado')
    await req.payload.update({
      collection: 'hilos',
      id,
      data: { ...(estado ? { estado: estado as 'abierto' | 'resuelto' } : {}), ...(f.has('asignado') ? { asignado: asignado ? Number(asignado) : null } : {}) },
      user: req.user,
      overrideAccess: false,
      req,
    })
    return 'Conversación actualizada.'
  })
}

export async function nuevaClave(_: Resultado, f: FormData): Promise<Resultado> {
  const { req, user } = await contexto()
  return ejecutar('/portal/asistentes', async () => {
    const dias = Math.min(Math.max(Number(campo(f, 'dias')) || 90, 1), 365)
    const r = await crearClave(req, { usuario: user.id, label: campo(f, 'nombre') || 'Asistente de IA', origen: 'manual', dias })
    return { ok: 'Clave creada. Cópiela ahora: no se volverá a mostrar.', clave: r.apiKey }
  })
}

export async function revocarClave(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  return ejecutar('/portal/asistentes', async () => {
    await req.payload.delete({ collection: COLECCION_CLAVES as 'payload-mcp-api-keys', id: campo(f, 'id'), user: req.user, overrideAccess: false, req })
    return 'Acceso revocado.'
  })
}
