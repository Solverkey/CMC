import path from 'path'
import type { PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { z } from 'zod'
import type { Categoria, Documento, Empresa, Envio, Hilo, Mensaje, User } from '@/payload-types'
import { empresasDe, esSuperAdmin } from '../access'
import { sugerir, type TipoCatalogo } from '../lib/catalogo'
import { ESTADOS, peorEstado, resolverGestion, type Estado } from '../lib/estado'
import { almacenamiento, conteoPorEmpresa } from '../lib/estadisticas'
import { tamano } from '../lib/subidas'
import { centroAvisos } from '../servicios/avisos'
import { crearHilo, escribirMensaje } from '../servicios/comunicacion'
import { buscarDocumentos, enlaceFirmado } from '../servicios/documentos'
import { cambiarRol, invitarUsuario, quitarAcceso, usuariosDeEmpresa } from '../servicios/usuarios'

type Resultado = { content: { type: 'text'; text: string }[] }
type Herramienta = { name: string; description: string; parameters: z.ZodRawShape; handler: (args: Record<string, unknown>, req: PayloadRequest, extra: unknown) => Promise<Resultado> }

const texto = (o: unknown): Resultado => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 2) }] })
const pedirConfirmacion = (accion: string) => texto(`CONFIRMACIÓN NECESARIA: ${accion}. Pregunte al usuario si está de acuerdo y, en ese caso, repita la llamada con confirmar=true.`)
const como = (req: PayloadRequest) => ({ user: req.user, overrideAccess: false as const, req })
const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string))
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-ES') : null)
const soloCMC = (req: PayloadRequest) => {
  if (!esSuperAdmin(req.user)) throw new APIError('Esta acción solo la puede hacer CMC.', 403, null, true)
}

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.heic': 'image/heic',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}

const ficheroDe = (a: Record<string, unknown>) => {
  if (!a.contenidoBase64 || !a.nombreArchivo) return undefined
  const data = Buffer.from(String(a.contenidoBase64), 'base64')
  const name = path.basename(String(a.nombreArchivo))
  return { data, name, size: data.length, mimetype: String(a.mimeType || MIME[path.extname(name).toLowerCase()] || 'application/octet-stream') }
}

const resumenDoc = (d: Documento) => {
  const empresa = d.empresa as Empresa
  const cat = d.categoria as Categoria
  return {
    id: d.id,
    titulo: d.titulo,
    empresa: empresa?.razonSocial,
    empresaId: empresa?.id,
    categoria: cat?.nombre,
    categoriaId: cat?.id,
    referencia: d.referencia,
    organismo: d.organismo,
    emision: fmt(d.fechaEmision),
    caducidad: d.fechaCaducidad ? fmt(d.fechaCaducidad) : 'Indefinido',
    aviso: fmt(d.fechaAviso),
    estado: ESTADOS[d.estado as Estado]?.label,
    condicionado: d.estadoManual === 'amarillo' && d.estado !== 'amarillo',
    gestion: resolverGestion(empresa?.gestion, cat?.gestion, d.gestion) === 'gestionado' ? 'Gestionado por CMC' : 'No gestionado',
  }
}

const id = z.union([z.string(), z.number()])
const confirmar = z.boolean().optional().describe('Debe ser true para ejecutar la acción, tras confirmarlo con el usuario.')
const fichero = {
  nombreArchivo: z.string().optional().describe('Nombre del archivo con su extensión, p. ej. renovacion.pdf'),
  contenidoBase64: z.string().optional().describe('Contenido del archivo codificado en base64 (máximo 50 MB).'),
  mimeType: z.string().optional(),
}

async function comprobarNombre(req: PayloadRequest, tipo: TipoCatalogo, nombre: string, aceptar?: boolean) {
  const s = await sugerir(req, tipo, nombre)
  if (s.exacta || aceptar || !s.similares.length) return null
  return texto(`«${nombre}» no existe en el catálogo, pero hay nombres muy parecidos: ${s.similares.map((n) => `«${n}»`).join(', ')}. Use uno de ellos o repita con aceptarNombreNuevo=true para añadir el nuevo.`)
}

const h = (name: string, description: string, parameters: z.ZodRawShape, fn: (a: any, req: PayloadRequest) => Promise<unknown>): Herramienta => ({
  name,
  description,
  parameters,
  handler: async (args, req) => {
    try {
      const r = await fn(args, req)
      return r && typeof r === 'object' && 'content' in r ? (r as Resultado) : texto(r)
    } catch (e) {
      return texto(`Error: ${(e as Error).message}`)
    }
  },
})

export const herramientas: Herramienta[] = [
  // ——— Consultas ———
  h('mis_empresas', 'Empresas a las que tiene acceso el usuario, con el semáforo (documentos por estado y peor estado) de cada una.', {}, async (_a, req) => {
    const { docs } = await req.payload.find({ collection: 'empresas', where: { activa: { equals: true } }, limit: 1000, depth: 0, sort: 'razonSocial', ...como(req) })
    const conteo = await conteoPorEmpresa(req.payload, esSuperAdmin(req.user) ? null : empresasDe(req.user))
    return docs.map((e) => {
      const c = conteo[String(e.id)] ?? { verde: 0, amarillo: 0, naranja: 0, rojo: 0, negro: 0 }
      const estados = (Object.entries(c) as [Estado, number][]).filter(([, n]) => n > 0).map(([k]) => k)
      return { id: e.id, razonSocial: e.razonSocial, cif: e.cif, peorEstado: ESTADOS[peorEstado(estados)].label, vigentes: c.verde, condicionados: c.amarillo, caducidadProxima: c.naranja, caducados: c.rojo }
    })
  }),
  h(
    'buscar_documentos',
    'Busca documentos por texto y filtros (empresa, categoría, estado, rango de fechas de caducidad). Estados: verde, amarillo, naranja, rojo (negro solo CMC).',
    {
      texto: z.string().optional(),
      empresa: id.optional(),
      categoria: id.optional(),
      estados: z.array(z.enum(['verde', 'amarillo', 'naranja', 'rojo', 'negro'])).optional(),
      caducaDesde: z.string().optional().describe('AAAA-MM-DD'),
      caducaHasta: z.string().optional().describe('AAAA-MM-DD'),
      limite: z.number().optional(),
    },
    async (a, req) => {
      const r = await buscarDocumentos(req, { q: a.texto, empresa: a.empresa, categoria: a.categoria, estados: a.estados, desde: a.caducaDesde, hasta: a.caducaHasta, limite: a.limite ?? 50, incluirNegros: a.estados?.includes('negro') })
      return { total: r.totalDocs, documentos: (r.docs as Documento[]).map(resumenDoc) }
    },
  ),
  h('proximos_vencimientos', 'Documentos que caducan en los próximos N días (30, 60, 90…), además de los caducados y condicionados. Sin empresa: todas las accesibles.', { dias: z.number().optional().describe('Por defecto 60'), empresa: id.optional() }, async (a, req) => {
    const limite = new Date(Date.now() + (a.dias ?? 60) * 86_400_000).toISOString()
    const where: Where = { and: [{ estado: { not_equals: 'negro' } }, { or: [{ estado: { in: ['rojo', 'amarillo'] } }, { fechaCaducidad: { less_than_equal: limite } }] }, ...(a.empresa ? [{ empresa: { equals: a.empresa } }] : [])] }
    const { docs } = await req.payload.find({ collection: 'documentos', where, sort: 'fechaCaducidad', limit: 500, depth: 1, ...como(req) })
    return (docs as Documento[]).map(resumenDoc)
  }),
  h('ver_documento', 'Ficha completa de un documento: datos, estado, modalidad de gestión, archivo vigente e histórico de archivos asociados.', { documento: id }, async (a, req) => {
    const d = (await req.payload.findByID({ collection: 'documentos', id: a.documento, depth: 1, ...como(req) })) as Documento
    const archivos = await req.payload.find({ collection: 'archivos', where: { documento: { equals: d.id } }, sort: '-createdAt', depth: 0, limit: 100, ...como(req) })
    return {
      ...resumenDoc(d),
      motivoEstado: d.motivoEstado,
      limiteSubsanacion: fmt(d.limiteSubsanacion),
      observaciones: d.observaciones,
      archivos: archivos.docs.map((x) => ({ id: x.id, nombre: x.filename, relacion: x.relacion, vigente: !x.historico, subido: fmt(x.createdAt), tamano: tamano(x.filesize), comentario: x.comentario })),
    }
  }),
  h('enlace_descarga', 'Genera un enlace de descarga temporal (10 minutos) del archivo vigente de un documento o de un archivo concreto.', { documento: id.optional(), archivo: id.optional() }, async (a, req) => {
    let archivo = a.archivo
    if (!archivo && a.documento) {
      const d = await req.payload.findByID({ collection: 'documentos', id: a.documento, depth: 0, ...como(req) })
      archivo = idDe(d.archivoVigente)
      if (!archivo) throw new APIError('El documento no tiene archivo vigente.', 404, null, true)
    }
    if (!archivo) throw new APIError('Indique el documento o el archivo.', 400, null, true)
    await req.payload.findByID({ collection: 'archivos', id: archivo, depth: 0, ...como(req) })
    return { enlace: enlaceFirmado(req, { k: 'fichero', c: 'archivos', i: String(archivo) }), caducaEnMinutos: 10 }
  }),
  h('descargar_zip', 'Enlace temporal para descargar en un ZIP el archivo vigente de varios documentos.', { documentos: z.array(id), conHistorico: z.boolean().optional() }, async (a, req) => ({
    enlace: enlaceFirmado(req, { k: 'zip', ids: a.documentos.map(String), h: a.conHistorico }),
    caducaEnMinutos: 10,
  })),
  h('exportar_inventario', 'Enlace temporal al inventario documental de una empresa con su estado, en Excel o PDF.', { empresa: id, formato: z.enum(['xlsx', 'pdf']).optional() }, async (a, req) => ({
    enlace: enlaceFirmado(req, { k: 'inventario', e: String(a.empresa), f: a.formato ?? 'xlsx' }),
    caducaEnMinutos: 10,
  })),
  h('avisos', 'Centro de notificaciones de una empresa: próximos avisos programados y correos enviados.', { empresa: id }, async (a, req) => {
    const r = await centroAvisos(req, a.empresa)
    return {
      proximos: r.proximos.map((p) => ({ fecha: fmt(p.fecha), tipo: p.tipo, documento: p.documento.titulo, documentoId: p.documento.id, gestionado: p.gestionado })),
      enviados: r.enviados.map((c) => ({ fecha: fmt(c.createdAt), asunto: c.asunto, para: c.para, estado: c.estado })),
    }
  }),
  h('listar_envios', 'Envíos de documentos a revisión y su estado (pendiente, publicado, rechazado). CMC ve la bandeja de todas las empresas.', { empresa: id.optional(), estado: z.enum(['pendiente', 'publicado', 'rechazado']).optional() }, async (a, req) => {
    const where: Where = { and: [...(a.empresa ? [{ empresa: { equals: a.empresa } }] : []), ...(a.estado ? [{ estado: { equals: a.estado } }] : [])] }
    const { docs } = await req.payload.find({ collection: 'envios', where, sort: '-createdAt', limit: 100, depth: 1, ...como(req) })
    return (docs as Envio[]).map((e) => ({ id: e.id, titulo: e.titulo, empresa: (e.empresa as Empresa)?.razonSocial, estado: e.estado, enviado: fmt(e.createdAt), archivo: e.filename, relacion: e.relacion, nuevaCaducidad: fmt(e.nuevaCaducidad), comentario: e.comentario, motivoRechazo: e.motivoRechazo }))
  }),
  h('listar_conversaciones', 'Conversaciones con CMC. Filtros: empresa, estado (abierto/resuelto) y, para CMC, soloMias (asignadas a mí).', { empresa: id.optional(), estado: z.enum(['abierto', 'resuelto']).optional(), soloMias: z.boolean().optional() }, async (a, req) => {
    const where: Where = { and: [...(a.empresa ? [{ empresa: { equals: a.empresa } }] : []), ...(a.estado ? [{ estado: { equals: a.estado } }] : []), ...(a.soloMias ? [{ asignado: { equals: req.user!.id } }] : [])] }
    const { docs } = await req.payload.find({ collection: 'hilos', where, sort: '-ultimoMensaje', limit: 100, depth: 1, ...como(req) })
    return (docs as Hilo[]).map((x) => ({ id: x.id, asunto: x.asunto, empresa: (x.empresa as Empresa)?.razonSocial, estado: x.estado, asignado: (x.asignado as User)?.nombre ?? null, documento: (x.documento as Documento)?.titulo ?? null, ultimoMensaje: fmt(x.ultimoMensaje) }))
  }),
  h('ver_conversacion', 'Mensajes de una conversación, en orden.', { conversacion: id }, async (a, req) => {
    const hilo = (await req.payload.findByID({ collection: 'hilos', id: a.conversacion, depth: 1, ...como(req) })) as Hilo
    const { docs } = await req.payload.find({ collection: 'mensajes', where: { hilo: { equals: hilo.id } }, sort: 'createdAt', limit: 1000, depth: 1, ...como(req) })
    return { asunto: hilo.asunto, estado: hilo.estado, mensajes: (docs as Mensaje[]).map((m) => ({ fecha: new Date(m.createdAt).toLocaleString('es-ES'), autor: (m.autor as User)?.nombre, texto: m.texto, adjuntos: (m.adjuntos ?? []).map((x) => (typeof x === 'object' ? x.filename : x)) })) }
  }),
  h('usuarios_de_empresa', 'Usuarios de una empresa y su rol (solo administradores de esa empresa y CMC).', { empresa: id }, async (a, req) => usuariosDeEmpresa(req, a.empresa)),
  h('registro_actividad', 'Registro de actividad (accesos, subidas, descargas, cambios de estado, correos). CMC: todo; administrador de empresa: sus empresas.', { empresa: id.optional(), accion: z.string().optional(), desde: z.string().optional().describe('AAAA-MM-DD'), limite: z.number().optional() }, async (a, req) => {
    const where: Where = { and: [...(a.empresa ? [{ empresa: { equals: a.empresa } }] : []), ...(a.accion ? [{ accion: { equals: a.accion } }] : []), ...(a.desde ? [{ createdAt: { greater_than_equal: new Date(a.desde).toISOString() } }] : [])] }
    const { docs } = await req.payload.find({ collection: 'actividad', where, sort: '-createdAt', limit: Math.min(a.limite ?? 50, 500), depth: 0, ...como(req) })
    return docs.map((x) => ({ fecha: new Date(x.createdAt).toLocaleString('es-ES'), accion: x.accion, descripcion: x.descripcion, usuario: x.email, origen: x.origen }))
  }),
  h('buscar_nombre_catalogo', 'Busca en los catálogos de nombres (categoria, documento, relacion) antes de crear uno nuevo, sin distinguir mayúsculas ni acentos.', { tipo: z.enum(['categoria', 'documento', 'relacion']), texto: z.string().optional() }, async (a, req) => sugerir(req, a.tipo, a.texto ?? '')),
  h('almacenamiento', 'Almacenamiento consumido, total y por empresa (solo CMC).', {}, async (_a, req) => {
    soloCMC(req)
    const u = await almacenamiento(req.payload)
    return { total: tamano(u.total), ficheros: tamano(u.ficheros), baseDeDatos: tamano(u.bd), porEmpresa: Object.fromEntries(Object.entries(u.porEmpresa).map(([k, v]) => [k, tamano(v)])) }
  }),

  // ——— Acciones del cliente (y de CMC) ———
  h(
    'enviar_documento_a_cmc',
    'Envía un documento a CMC para su revisión (los usuarios de empresa no publican directamente). Para una renovación, indique el documento al que se refiere.',
    { empresa: id, titulo: z.string(), documento: id.optional(), relacion: z.string().optional().describe('Renovación, Subsanación, Anexo…'), nuevaCaducidad: z.string().optional().describe('AAAA-MM-DD'), comentario: z.string().optional(), ...fichero },
    async (a, req) => {
      const file = ficheroDe(a)
      if (!file) throw new APIError('Adjunte el archivo (nombreArchivo y contenidoBase64).', 400, null, true)
      const e = await req.payload.create({
        collection: 'envios',
        data: { titulo: a.titulo, empresa: Number(a.empresa), documentoRelacionado: a.documento ? Number(a.documento) : undefined, relacion: a.relacion ?? (a.documento ? 'Renovación' : 'Original'), nuevaCaducidad: a.nuevaCaducidad, comentario: a.comentario },
        file,
        ...como(req),
      })
      return `Enviado a CMC para revisión (envío ${e.id}). Estado: pendiente.`
    },
  ),
  h('escribir_a_cmc', 'Escribe un mensaje: en una conversación existente o en una nueva (empresa + asunto, opcionalmente vinculada a un documento).', { conversacion: id.optional(), empresa: id.optional(), asunto: z.string().optional(), documento: id.optional(), texto: z.string() }, async (a, req) => {
    if (a.conversacion) {
      await escribirMensaje(req, { hilo: a.conversacion, texto: a.texto })
      return 'Mensaje enviado.'
    }
    if (!a.empresa || !a.asunto) throw new APIError('Para una conversación nueva indique empresa y asunto.', 400, null, true)
    const hilo = await crearHilo(req, { empresa: a.empresa, asunto: a.asunto, documento: a.documento, texto: a.texto })
    return `Conversación ${hilo.id} creada y mensaje enviado.`
  }),
  h('dar_de_alta_usuario', 'Da acceso a un usuario en una empresa (administrador de empresa o CMC). Si el email ya existe, se le añade la empresa.', { empresa: id, email: z.string(), nombre: z.string().optional(), rol: z.enum(['admin', 'usuario']).optional() }, async (a, req) => {
    const r = await invitarUsuario(req, { empresa: a.empresa, email: a.email, nombre: a.nombre, rol: a.rol ?? 'usuario' })
    return r.creado ? `Usuario creado; se le ha enviado la invitación a ${a.email}.` : `${a.email} ya existía: se le ha dado acceso a la empresa.`
  }),
  h('quitar_acceso_usuario', 'Retira el acceso de un usuario a una empresa (si se queda sin empresas, se da de baja).', { usuario: id, empresa: id, confirmar }, async (a, req) => {
    if (!a.confirmar) return pedirConfirmacion(`retirar el acceso del usuario ${a.usuario} a la empresa ${a.empresa}`)
    await quitarAcceso(req, { usuario: a.usuario, empresa: a.empresa })
    return 'Acceso retirado.'
  }),
  h('cambiar_rol_usuario', 'Cambia el rol (admin/usuario) de un usuario en una empresa.', { usuario: id, empresa: id, rol: z.enum(['admin', 'usuario']), confirmar }, async (a, req) => {
    if (!a.confirmar) return pedirConfirmacion(`cambiar el rol del usuario ${a.usuario} a ${a.rol}`)
    await cambiarRol(req, a)
    return 'Rol cambiado.'
  }),

  // ——— Acciones de CMC ———
  h(
    'alta_empresa',
    'CMC: da de alta una empresa cliente y su administrador (recibe una invitación por correo). Aplica la plantilla de categorías estándar.',
    { razonSocial: z.string(), cif: z.string(), direccion: z.string().optional(), sector: z.string().optional(), contacto: z.string().optional(), emailsAviso: z.array(z.string()).optional(), gestion: z.enum(['gestionado', 'no_gestionado']).optional(), adminEmail: z.string(), adminNombre: z.string().optional(), aplicarPlantilla: z.boolean().optional(), confirmar },
    async (a, req) => {
      soloCMC(req)
      if (!a.confirmar) return pedirConfirmacion(`dar de alta la empresa «${a.razonSocial}» (${a.cif}) con administrador ${a.adminEmail}`)
      const e = await req.payload.create({
        collection: 'empresas',
        data: { razonSocial: a.razonSocial, cif: a.cif, direccion: a.direccion, sector: a.sector, contacto: a.contacto, emailsAviso: (a.emailsAviso ?? []).map((email: string) => ({ email })), gestion: a.gestion, adminEmail: a.adminEmail, adminNombre: a.adminNombre, aplicarPlantilla: a.aplicarPlantilla ?? true } as never,
        ...como(req),
      })
      return `Empresa ${e.id} creada. Invitación enviada a ${a.adminEmail}.`
    },
  ),
  h('baja_o_reactivacion_empresa', 'CMC: baja lógica (bloquea los accesos, conserva el histórico) o reactivación de una empresa.', { empresa: id, activa: z.boolean(), confirmar }, async (a, req) => {
    soloCMC(req)
    const e = await req.payload.findByID({ collection: 'empresas', id: a.empresa, depth: 0, ...como(req) })
    if (!a.confirmar) return pedirConfirmacion(`${a.activa ? 'reactivar' : 'dar de baja'} la empresa «${e.razonSocial}»`)
    await req.payload.update({ collection: 'empresas', id: e.id, data: { activa: a.activa }, ...como(req) })
    return a.activa ? 'Empresa reactivada.' : 'Empresa dada de baja.'
  }),
  h('crear_categoria', 'CMC: crea una categoría en una empresa. Comprueba el catálogo de nombres antes de añadir uno nuevo.', { empresa: id, nombre: z.string(), antelacionMeses: z.number().optional(), gestion: z.enum(['gestionado', 'no_gestionado']).optional(), descripcion: z.string().optional(), aceptarNombreNuevo: z.boolean().optional() }, async (a, req) => {
    soloCMC(req)
    const aviso = await comprobarNombre(req, 'categoria', a.nombre, a.aceptarNombreNuevo)
    if (aviso) return aviso
    const c = await req.payload.create({ collection: 'categorias', data: { empresa: Number(a.empresa), nombre: a.nombre, antelacionMeses: a.antelacionMeses, gestion: a.gestion, descripcion: a.descripcion }, ...como(req) })
    return `Categoría ${c.id} creada.`
  }),
  h(
    'crear_documento',
    'CMC: publica un documento nuevo (opcionalmente con su archivo original). La fecha de aviso se propone sola si no se indica.',
    { empresa: id, categoria: id, titulo: z.string(), referencia: z.string().optional(), organismo: z.string().optional(), fechaEmision: z.string().optional(), fechaCaducidad: z.string().optional(), fechaAviso: z.string().optional(), gestion: z.enum(['gestionado', 'no_gestionado']).optional(), aceptarNombreNuevo: z.boolean().optional(), ...fichero },
    async (a, req) => {
      soloCMC(req)
      const aviso = await comprobarNombre(req, 'documento', a.titulo, a.aceptarNombreNuevo)
      if (aviso) return aviso
      const d = await req.payload.create({ collection: 'documentos', data: { empresa: Number(a.empresa), categoria: Number(a.categoria), titulo: a.titulo, referencia: a.referencia, organismo: a.organismo, fechaEmision: a.fechaEmision, fechaCaducidad: a.fechaCaducidad, fechaAviso: a.fechaAviso, gestion: a.gestion }, ...como(req) })
      const file = ficheroDe(a)
      if (file) await req.payload.create({ collection: 'archivos', data: { documento: d.id, relacion: 'Original' }, file, ...como(req) })
      return { documento: resumenDoc((await req.payload.findByID({ collection: 'documentos', id: d.id, depth: 1, ...como(req) })) as Documento) }
    },
  ),
  h(
    'editar_documento',
    'CMC: edita los metadatos de un documento o lo mueve de categoría (queda registrado).',
    { documento: id, titulo: z.string().optional(), categoria: id.optional(), referencia: z.string().optional(), organismo: z.string().optional(), fechaEmision: z.string().optional(), fechaCaducidad: z.string().nullable().optional(), fechaAviso: z.string().optional(), observaciones: z.string().optional(), confirmar },
    async (a, req) => {
      soloCMC(req)
      const { documento, confirmar: ok, ...campos } = a
      if (campos.categoria && !ok) return pedirConfirmacion(`mover el documento ${documento} a la categoría ${campos.categoria}`)
      if (campos.categoria) campos.categoria = Number(campos.categoria)
      const d = await req.payload.update({ collection: 'documentos', id: documento, data: campos, depth: 1, ...como(req) })
      return resumenDoc(d as Documento)
    },
  ),
  h(
    'asociar_archivo',
    'CMC: asocia un archivo nuevo a un documento existente (renovación, subsanación, anexo o un tipo nuevo, indicando su efecto). Si sustituye al vigente, el anterior pasa al histórico.',
    { documento: id, relacion: z.string(), efectos: z.array(z.enum(['sustituye', 'actualiza_fechas', 'levanta', 'complementario'])).optional(), nuevaCaducidad: z.string().optional(), nuevoAviso: z.string().optional(), comentario: z.string().optional(), aceptarNombreNuevo: z.boolean().optional(), ...fichero },
    async (a, req) => {
      soloCMC(req)
      const file = ficheroDe(a)
      if (!file) throw new APIError('Adjunte el archivo (nombreArchivo y contenidoBase64).', 400, null, true)
      const aviso = await comprobarNombre(req, 'relacion', a.relacion, a.aceptarNombreNuevo)
      if (aviso) return aviso
      await req.payload.create({ collection: 'archivos', data: { documento: Number(a.documento), relacion: a.relacion, efectos: a.efectos, nuevaCaducidad: a.nuevaCaducidad, nuevoAviso: a.nuevoAviso, comentario: a.comentario }, file, ...como(req) })
      return resumenDoc((await req.payload.findByID({ collection: 'documentos', id: a.documento, depth: 1, ...como(req) })) as Documento)
    },
  ),
  h(
    'publicar_envio',
    'CMC: publica un envío recibido, en un documento existente (documentoDestino) o como documento nuevo (categoria + fechas).',
    { envio: id, documentoDestino: id.optional(), categoria: id.optional(), titulo: z.string().optional(), relacion: z.string().optional(), fechaEmision: z.string().optional(), fechaCaducidad: z.string().optional(), fechaAviso: z.string().optional(), confirmar },
    async (a, req) => {
      soloCMC(req)
      const e = await req.payload.findByID({ collection: 'envios', id: a.envio, depth: 0, ...como(req) })
      if (!a.confirmar) return pedirConfirmacion(`publicar el envío «${e.titulo}» ${a.documentoDestino ? `en el documento ${a.documentoDestino}` : 'como documento nuevo'}`)
      await req.payload.update({
        collection: 'envios',
        id: e.id,
        data: { estado: 'publicado', documentoDestino: a.documentoDestino ? Number(a.documentoDestino) : undefined, categoriaDestino: a.categoria ? Number(a.categoria) : undefined, tituloFinal: a.titulo, relacionFinal: a.relacion, fechaEmision: a.fechaEmision, fechaCaducidad: a.fechaCaducidad, fechaAviso: a.fechaAviso },
        ...como(req),
      })
      return 'Envío publicado. Se ha avisado al usuario que lo envió.'
    },
  ),
  h('rechazar_envio', 'CMC: rechaza un envío recibido indicando el motivo (se avisa al usuario).', { envio: id, motivo: z.string(), confirmar }, async (a, req) => {
    soloCMC(req)
    if (!a.confirmar) return pedirConfirmacion(`rechazar el envío ${a.envio} con el motivo «${a.motivo}»`)
    await req.payload.update({ collection: 'envios', id: a.envio, data: { estado: 'rechazado', motivoRechazo: a.motivo }, ...como(req) })
    return 'Envío rechazado.'
  }),
  h(
    'cambiar_estado_manual',
    'CMC: fija un estado manual (amarillo = condicionada, rojo = revocada, negro = ya no aplica) con su motivo, o lo quita (ninguno).',
    { documento: id, estado: z.enum(['amarillo', 'rojo', 'negro', 'ninguno']), motivo: z.string().optional(), limiteSubsanacion: z.string().optional(), confirmar },
    async (a, req) => {
      soloCMC(req)
      if (a.estado !== 'ninguno' && !a.motivo) throw new APIError('Indique el motivo.', 400, null, true)
      if (!a.confirmar) return pedirConfirmacion(`cambiar el estado manual del documento ${a.documento} a «${a.estado}»`)
      const d = await req.payload.update({ collection: 'documentos', id: a.documento, data: { estadoManual: a.estado === 'ninguno' ? null : a.estado, motivoEstado: a.estado === 'ninguno' ? null : a.motivo, limiteSubsanacion: a.limiteSubsanacion }, depth: 1, ...como(req) })
      return resumenDoc(d as Documento)
    },
  ),
  h(
    'cambiar_modalidad_gestion',
    'CMC: marca una empresa, categoría o documento como Gestionado / No gestionado, o lo deja heredar del nivel superior.',
    { nivel: z.enum(['empresa', 'categoria', 'documento']), id, gestion: z.enum(['gestionado', 'no_gestionado', 'heredar']), confirmar },
    async (a, req) => {
      soloCMC(req)
      const coleccion = ({ empresa: 'empresas', categoria: 'categorias', documento: 'documentos' } as const)[a.nivel as 'empresa']
      if (!a.confirmar && a.nivel !== 'documento') return pedirConfirmacion(`cambiar la modalidad de ${a.nivel} ${a.id} a «${a.gestion}» (afecta a todos sus documentos que no tengan modalidad propia)`)
      await req.payload.update({ collection: coleccion, id: a.id, data: { gestion: a.gestion === 'heredar' ? null : a.gestion }, ...como(req) })
      return 'Modalidad actualizada.'
    },
  ),
  h('gestionar_conversacion', 'CMC: marca una conversación como abierta o resuelta y/o la asigna a una persona de CMC.', { conversacion: id, estado: z.enum(['abierto', 'resuelto']).optional(), asignado: id.optional() }, async (a, req) => {
    soloCMC(req)
    await req.payload.update({ collection: 'hilos', id: a.conversacion, data: { ...(a.estado ? { estado: a.estado } : {}), ...(a.asignado ? { asignado: Number(a.asignado) } : {}) }, ...como(req) })
    return 'Conversación actualizada.'
  }),
  h('exportar_comunicaciones', 'Enlace temporal al historial de comunicaciones (PDF) de una empresa o de un documento.', { empresa: id, documento: id.optional() }, async (a, req) => ({
    enlace: enlaceFirmado(req, { k: 'historial', e: String(a.empresa), d: a.documento ? String(a.documento) : undefined }),
    caducaEnMinutos: 10,
  })),
]
