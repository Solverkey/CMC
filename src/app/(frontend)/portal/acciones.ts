'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { administraEmpresa } from '@/access'
import { contexto, idDe } from '@/lib/payload'
import { registrar } from '@/lib/actividad'
import { restarMeses } from '@/lib/estado'
import { PLANTILLAS, type ClavePlantilla } from '@/lib/plantillas'
import { guardarConfiguracion as persistirConfig } from '@/lib/configuracion'
import { crearClave, revocarClave as borrarClave } from '@/mcp/claves'
import { cambiarEquipoCmc, cambiarRol, enviarInvitacion, invitarCmc, invitarUsuario, quitarAcceso } from '@/servicios/usuarios'
import { usuarioPorId } from '@/datos/usuarios'
import { empresaPorId } from '@/datos/consultas'
import { actualizarCategoria, actualizarDocumento, actualizarEmpresa, crearEmpresa, crearMedia, resolverEnvio as publicarEnvio } from '@/datos/operaciones'
import { crearCatalogo, desactivarCatalogo, type Efecto } from '@/lib/catalogo'
import { adjuntoADocumento, gestionarHilo as actualizarHilo, vincularDocumento } from '@/servicios/comunicacion'
import type { Fichero } from '@/lib/subidas'

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
const fecha = (f: FormData, k: string) => campo(f, k) || null
const esRedireccion = (e: unknown) => typeof e === 'object' && e !== null && 'digest' in e && String((e as { digest: string }).digest).startsWith('NEXT_REDIRECT')

async function comoCmc() {
  const ctx = await contexto()
  if (!ctx.cmc) throw new Error('Solo CMC puede hacer esto.')
  return ctx
}

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
    const u = await usuarioPorId(campo(f, 'usuario'))
    if (!u || !(u.empresas ?? []).some((m) => idDe(m.empresa) === empresa)) throw new Error('Ese usuario no pertenece a la empresa.')
    const emp = await empresaPorId(empresa)
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
    await actualizarHilo(req, id, {
      ...(estado ? { estado: estado as 'abierto' | 'resuelto' } : {}),
      ...(f.has('asignado') ? { asignado: asignado ? Number(asignado) : null } : {}),
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

export async function altaEmpresa(_: Resultado, f: FormData): Promise<Resultado> {
  try {
    const { req } = await comoCmc()
    const emails = campo(f, 'emails').split(/[,;\s]+/).filter(Boolean).map((email) => ({ email }))
    const razon = campo(f, 'razonSocial')
    await crearEmpresa(req, {
      razonSocial: razon,
      cif: campo(f, 'cif'),
      direccion: campo(f, 'direccion') || undefined,
      sector: campo(f, 'sector') || undefined,
      contacto: campo(f, 'contacto') || undefined,
      emailsAviso: emails,
      gestion: (campo(f, 'gestion') || undefined) as 'gestionado' | 'no_gestionado' | undefined,
      adminEmail: campo(f, 'adminEmail'),
      adminNombre: campo(f, 'adminNombre') || undefined,
      aplicarPlantilla: f.get('aplicarPlantilla') === 'on',
    })
    revalidatePath('/portal')
    return { ok: `Empresa «${razon}» creada.` }
  } catch (e) {
    if (esRedireccion(e)) throw e
    return { error: (e as Error).message || 'No se ha podido crear la empresa.' }
  }
}

export async function guardarAvisoEmpresa(_: Resultado, f: FormData): Promise<Resultado> {
  return ejecutar('/portal', async () => {
    const { req } = await comoCmc()
    const meses = campo(f, 'antelacionMeses')
    await actualizarEmpresa(req, campo(f, 'empresa'), { antelacionMeses: meses === '' ? null : Number(meses) })
    return 'Aviso estándar del cliente actualizado.'
  })
}

export async function guardarAntelacionCategoria(_: Resultado, f: FormData): Promise<Resultado> {
  return ejecutar('/portal', async () => {
    const { req } = await comoCmc()
    const meses = campo(f, 'antelacionMeses')
    await actualizarCategoria(req, campo(f, 'categoria'), { antelacionMeses: meses === '' ? null : Number(meses) })
    return 'Antelación de la instalación actualizada.'
  })
}

export async function crearSelector(_: Resultado, f: FormData): Promise<Resultado> {
  return ejecutar('/portal/selectores', async () => {
    const { req } = await comoCmc()
    const tipo = campo(f, 'tipo')
    if (!['categoria', 'documento', 'relacion'].includes(tipo)) throw new Error('Tipo no válido.')
    const efectos = f.getAll('efectos').map(String) as Efecto[]
    await crearCatalogo(req, tipo as 'categoria' | 'documento' | 'relacion', campo(f, 'nombre'), efectos)
    return 'Opción añadida.'
  })
}

export async function quitarSelector(_: Resultado, f: FormData): Promise<Resultado> {
  return ejecutar('/portal/selectores', async () => {
    const { req } = await comoCmc()
    await desactivarCatalogo(req, campo(f, 'id'))
    return 'Opción quitada del selector.'
  })
}

export async function guardarDocumento(_: Resultado, f: FormData): Promise<Resultado> {
  try {
    const { req } = await comoCmc()
    const id = campo(f, 'id')
    if (!id) return { error: 'El documento entra al subir el archivo, no se crea vacío.' }
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
    const meses = campo(f, 'antelacionMeses')
    if (meses !== '' && data.fechaCaducidad) data.fechaAviso = restarMeses(new Date(data.fechaCaducidad), Number(meses)).toISOString()
    const doc = await actualizarDocumento(req, id, data)
    revalidatePath('/portal')
    revalidatePath(`/portal/documentos/${doc.id}`)
    return { ok: 'Documento actualizado.' }
  } catch (e) {
    if (esRedireccion(e)) throw e
    return { error: (e as Error).message || 'No se ha podido guardar el documento.' }
  }
}

export async function resolverEnvio(_: Resultado, f: FormData): Promise<Resultado> {
  try {
    const { req } = await comoCmc()
    const decision = campo(f, 'decision')
    await publicarEnvio(
      req,
      campo(f, 'id'),
      decision === 'rechazado'
        ? { estado: 'rechazado', motivoRechazo: campo(f, 'motivoRechazo') }
        : {
            estado: 'publicado',
            documentoDestino: campo(f, 'documentoDestino') ? Number(campo(f, 'documentoDestino')) : null,
            categoriaDestino: campo(f, 'categoriaDestino') ? Number(campo(f, 'categoriaDestino')) : null,
            tituloFinal: campo(f, 'tituloFinal') || null,
            relacionFinal: campo(f, 'relacionFinal') || null,
            fechaEmision: fecha(f, 'fechaEmision'),
            fechaCaducidad: fecha(f, 'fechaCaducidad'),
            fechaAviso: fecha(f, 'fechaAviso'),
          },
    )
    revalidatePath('/portal/enviar')
    redirect('/portal/enviar')
  } catch (e) {
    if (esRedireccion(e)) throw e
    return { error: (e as Error).message || 'No se ha podido resolver el envío.' }
  }
}

const entero = (f: FormData, k: string, min: number, max: number, etiqueta: string) => {
  const raw = campo(f, k)
  const n = Number(raw)
  if (raw === '' || !Number.isFinite(n) || n < min || n > max) throw new Error(`${etiqueta}: un número entre ${min} y ${max}.`)
  return n
}

const correoOpcional = (f: FormData, k: string, etiqueta: string) => {
  const v = campo(f, k)
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new Error(`${etiqueta} no es un correo válido.`)
  return v || null
}

export async function guardarConfiguracion(_: Resultado, f: FormData): Promise<Resultado> {
  return ejecutar('/portal/configuracion', async () => {
    const { req } = await comoCmc()
    const frecuencia = campo(f, 'frecuenciaCaducado')
    if (frecuencia !== 'semanal' && frecuencia !== 'mensual') throw new Error('Elija cada cuánto recordar un documento caducado.')
    const color = campo(f, 'colorPrimario')
    if (!/^#[0-9a-f]{3,8}$/i.test(color)) throw new Error('El color tiene que ser hexadecimal, por ejemplo #4d6162.')
    const nombres = f.getAll('catNombre').map((v) => String(v).trim())
    const meses = f.getAll('catMeses').map((v) => String(v).trim())
    const gestiones = f.getAll('catGestion').map((v) => String(v))
    const descripciones = f.getAll('catDescripcion').map((v) => String(v).trim())
    if (!nombres.length) throw new Error('Añada al menos una instalación a la plantilla de alta.')
    const plantillaCategorias = nombres.map((nombre, i) => {
      if (!nombre) throw new Error('Cada instalación de la plantilla necesita un nombre.')
      const g = gestiones[i] ?? ''
      if (g && g !== 'gestionado' && g !== 'no_gestionado') throw new Error(`Modalidad no válida en «${nombre}».`)
      let antelacionMeses: number | null = null
      if (meses[i]) {
        const n = Number(meses[i])
        if (!Number.isFinite(n) || n < 0 || n > 120) throw new Error(`Antelación de «${nombre}»: entre 0 y 120 meses.`)
        antelacionMeses = n
      }
      return { nombre, antelacionMeses, gestion: (g || null) as 'gestionado' | 'no_gestionado' | null, descripcion: descripciones[i] || null }
    })
    const plantillas: Record<string, { asunto: string; cuerpo: string; boton: string | null }> = {}
    for (const clave of Object.keys(PLANTILLAS) as ClavePlantilla[]) {
      const base = PLANTILLAS[clave]
      plantillas[clave] = { asunto: campo(f, `p_${clave}_asunto`) || base.asunto, cuerpo: campo(f, `p_${clave}_cuerpo`) || base.cuerpo, boton: campo(f, `p_${clave}_boton`) || base.boton || null }
    }
    let logo: number | null
    const archivo = f.get('logo')
    if (archivo instanceof File && archivo.size > 0) {
      if (!archivo.type.startsWith('image/')) throw new Error('El logotipo tiene que ser una imagen.')
      const fichero: Fichero = { data: Buffer.from(await archivo.arrayBuffer()), mimetype: archivo.type, name: archivo.name, size: archivo.size }
      logo = await crearMedia(req, 'Logotipo de CMC', fichero)
    } else if (f.get('quitarLogo') === 'on') logo = null
    else logo = campo(f, 'logoId') ? Number(campo(f, 'logoId')) : null
    await persistirConfig({
      antelacionMeses: entero(f, 'antelacionMeses', 0, 120, 'Antelación de aviso'),
      recordatorioDiasAntes: entero(f, 'recordatorioDiasAntes', 0, 365, 'Recordatorio previo'),
      frecuenciaCaducado: frecuencia,
      maxRecordatoriosCaducado: entero(f, 'maxRecordatoriosCaducado', 0, 100, 'Máximo de recordatorios'),
      remitenteNombre: campo(f, 'remitenteNombre') || 'CMC · Portal documental',
      remitenteEmail: correoOpcional(f, 'remitenteEmail', 'Dirección del remitente'),
      responderA: correoOpcional(f, 'responderA', 'Dirección de respuesta'),
      logo,
      colorPrimario: color,
      firma: campo(f, 'firma') || 'CMC · Consultoría de calidad y medio ambiente',
      plantillas,
      ladoMaximo: entero(f, 'ladoMaximo', 500, 8000, 'Tamaño de imagen'),
      calidad: entero(f, 'calidad', 40, 100, 'Calidad de imagen'),
      conservarOriginal: f.get('conservarOriginal') === 'on',
      plantillaCategorias,
    })
    await registrar(req, { accion: 'edicion', descripcion: 'Configuración de la plataforma actualizada (avisos, correo, imágenes o plantilla de alta)', coleccion: 'configuracion' })
    revalidatePath('/portal')
    revalidatePath('/portal/almacenamiento')
    return 'Configuración guardada.'
  })
}

export async function revocarClave(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  return ejecutar('/portal/asistentes', async () => {
    await borrarClave(req, campo(f, 'id'))
    return 'Acceso revocado.'
  })
}

export async function invitarEquipo(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  return ejecutar('/portal/usuarios', async () => {
    await invitarCmc(req, { email: campo(f, 'email'), nombre: campo(f, 'nombre') || undefined })
    return `Invitación enviada a ${campo(f, 'email')}. Al entrar tendrá que activar el doble factor.`
  })
}

export async function cambiarEquipo(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  return ejecutar('/portal/usuarios', async () => {
    const accion = campo(f, 'accion')
    if (accion === 'desactivar') await cambiarEquipoCmc(req, campo(f, 'usuario'), { activo: false })
    else if (accion === 'activar') await cambiarEquipoCmc(req, campo(f, 'usuario'), { activo: true })
    else if (accion === 'avisos-si') await cambiarEquipoCmc(req, campo(f, 'usuario'), { recibeAvisos: true })
    else if (accion === 'avisos-no') await cambiarEquipoCmc(req, campo(f, 'usuario'), { recibeAvisos: false })
    else throw new Error('Acción no válida.')
    return 'Equipo actualizado.'
  })
}

export async function incorporarAdjunto(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  try {
    const r = await adjuntoADocumento(req, {
      adjunto: campo(f, 'adjunto'),
      documento: campo(f, 'documento'),
      relacion: campo(f, 'relacion'),
      nuevaCaducidad: fecha(f, 'nuevaCaducidad'),
      nuevoAviso: fecha(f, 'nuevoAviso'),
    })
    revalidatePath(`/portal/documentos/${r.documento.id}`)
    revalidatePath('/portal/mensajes', 'layout')
    return { ok: `Añadido al documento «${r.documento.titulo}».` }
  } catch (e) {
    return { error: (e as Error).message || 'No se ha podido añadir.' }
  }
}

export async function vincularDocumentoHilo(_: Resultado, f: FormData): Promise<Resultado> {
  const { req } = await contexto()
  return ejecutar(`/portal/mensajes/${campo(f, 'hilo')}`, async () => {
    const documento = campo(f, 'documento')
    await vincularDocumento(req, campo(f, 'hilo'), documento || null)
    return documento ? 'Conversación vinculada al documento.' : 'Conversación desvinculada.'
  })
}
