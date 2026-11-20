'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
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

const fecha = (f: FormData, k: string) => campo(f, k) || null
const esRedireccion = (e: unknown) => typeof e === 'object' && e !== null && 'digest' in e && String((e as { digest: string }).digest).startsWith('NEXT_REDIRECT')

async function comoCmc() {
  const ctx = await contexto()
  if (!ctx.cmc) throw new Error('Solo CMC puede hacer esto.')
  return ctx
}

export async function altaEmpresa(_: Resultado, f: FormData): Promise<Resultado> {
  try {
    const { req } = await comoCmc()
    const emails = campo(f, 'emails').split(/[,;\s]+/).filter(Boolean).map((email) => ({ email }))
    const doc = await req.payload.create({
      collection: 'empresas',
      data: {
        razonSocial: campo(f, 'razonSocial'),
        cif: campo(f, 'cif'),
        direccion: campo(f, 'direccion') || undefined,
        sector: campo(f, 'sector') || undefined,
        contacto: campo(f, 'contacto') || undefined,
        emailsAviso: emails,
        gestion: (campo(f, 'gestion') || undefined) as 'gestionado' | 'no_gestionado' | undefined,
        adminEmail: campo(f, 'adminEmail'),
        adminNombre: campo(f, 'adminNombre') || undefined,
        aplicarPlantilla: f.get('aplicarPlantilla') === 'on',
      } as never,
      user: req.user,
      overrideAccess: false,
      req,
    })
    revalidatePath('/portal')
    redirect(`/portal?empresa=${doc.id}`)
  } catch (e) {
    if (esRedireccion(e)) throw e
    return { error: (e as Error).message || 'No se ha podido crear la empresa.' }
  }
}

export async function guardarDocumento(_: Resultado, f: FormData): Promise<Resultado> {
  try {
    const { req } = await comoCmc()
    const id = campo(f, 'id')
    const data = {
      titulo: campo(f, 'titulo'),
      empresa: Number(campo(f, 'empresa')),
      categoria: Number(campo(f, 'categoria')),
      referencia: campo(f, 'referencia') || null,
      organismo: campo(f, 'organismo') || null,
      fechaEmision: fecha(f, 'fechaEmision'),
      fechaCaducidad: fecha(f, 'fechaCaducidad'),
      fechaAviso: fecha(f, 'fechaAviso'),
      estadoManual: (campo(f, 'estadoManual') || null) as 'naranja' | 'rojo' | 'azul' | 'negro' | null,
      motivoEstado: campo(f, 'motivoEstado') || null,
      limiteSubsanacion: fecha(f, 'limiteSubsanacion'),
      gestion: (campo(f, 'gestion') || null) as 'gestionado' | 'no_gestionado' | null,
      observaciones: campo(f, 'observaciones') || null,
    }
    const doc = id
      ? await req.payload.update({ collection: 'documentos', id, data, user: req.user, overrideAccess: false, req })
      : await req.payload.create({ collection: 'documentos', data, user: req.user, overrideAccess: false, req })
    revalidatePath('/portal')
    revalidatePath(`/portal/documentos/${doc.id}`)
    redirect(`/portal/documentos/${doc.id}`)
  } catch (e) {
    if (esRedireccion(e)) throw e
    return { error: (e as Error).message || 'No se ha podido guardar el documento.' }
  }
}

export async function resolverEnvio(_: Resultado, f: FormData): Promise<Resultado> {
  try {
    const { req } = await comoCmc()
    const id = campo(f, 'id')
    const decision = campo(f, 'decision')
    const data = decision === 'rechazado'
      ? { estado: 'rechazado' as const, motivoRechazo: campo(f, 'motivoRechazo') }
      : {
          estado: 'publicado' as const,
          documentoDestino: campo(f, 'documentoDestino') ? Number(campo(f, 'documentoDestino')) : null,
          categoriaDestino: campo(f, 'categoriaDestino') ? Number(campo(f, 'categoriaDestino')) : null,
          tituloFinal: campo(f, 'tituloFinal') || null,
          relacionFinal: campo(f, 'relacionFinal') || null,
          fechaEmision: fecha(f, 'fechaEmision'),
          fechaCaducidad: fecha(f, 'fechaCaducidad'),
          fechaAviso: fecha(f, 'fechaAviso'),
        }
    await req.payload.update({ collection: 'envios', id, data, user: req.user, overrideAccess: false, req })
    revalidatePath('/portal/enviar')
    redirect('/portal/enviar')
  } catch (e) {
    if (esRedireccion(e)) throw e
    return { error: (e as Error).message || 'No se ha podido resolver el envío.' }
  }
}

export async function revocarClave(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  return ejecutar('/portal/asistentes', async () => {
    await req.payload.delete({ collection: COLECCION_CLAVES as 'payload-mcp-api-keys', id: campo(f, 'id'), user: req.user, overrideAccess: false, req })
    return 'Acceso revocado.'
  })
}
