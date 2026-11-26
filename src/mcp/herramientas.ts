import path from 'path'
import { z } from 'zod'
import type { Adjunto, Categoria, Documento, Empresa, Envio, User } from '@/datos/tipos'
import { archivoPorId, archivosDeDocumento, categoriasDeEmpresa, contar, contarNoLeidas, contarPendientesDeRespuesta, documentoPorId, empresaPorId, empresaVisible, envioPorId, hiloPorId, listarActividad, listarDocumentos, listarEnvios, listarHilos, marcarLeido, mensajesDeHilo, noLeidos, ultimosMensajes, usuariosCms } from '@/datos/consultas'
import { actualizarCategoria, actualizarDocumento, actualizarEmpresa, crearArchivo, crearDocumento, crearEmpresa, crearEnvio, resolverEnvio } from '@/datos/operaciones'
import { administraEmpresa, empresasDe, esSuperAdmin } from '../access'
import { AppError } from '../lib/appError'
import { sugerir, type TipoCatalogo } from '../lib/catalogo'
import type { Ctx } from '../lib/ctx'
import { ahora, bit, uno } from '../lib/db'
import { empresasDelUsuario } from '../lib/payload'
import { ESTADOS, peorEstado, resolverGestion, type Estado } from '../lib/estado'
import { almacenamiento, conteoPorEmpresa } from '../lib/estadisticas'
import { tamano } from '../lib/subidas'
import { urlServidor } from '../lib/configuracion'
import { centroAvisos } from '../servicios/avisos'
import { registrar } from '../lib/actividad'
import { crearHilo, escribirMensaje, gestionarHilo, subirAdjunto } from '../servicios/comunicacion'
import { buscarDocumentos, enlaceFirmado, fechaValida } from '../servicios/documentos'
import { cambiarRol, invitarUsuario, quitarAcceso, usuariosDeEmpresa } from '../servicios/usuarios'

type Resultado = { content: { type: 'text'; text: string }[]; isError?: boolean }

/**
 * Quién puede usar cada herramienta. Se aplica dos veces: al listar (cada asistente solo ve lo que su usuario puede hacer)
 * y al ejecutar. Además, cada servicio vuelve a comprobar los permisos sobre la empresa concreta.
 * - todos: cualquier usuario del portal (solo sobre sus empresas).
 * - admin: CMC y administradores de empresa.
 * - cmc: solo CMC (super administradores con doble factor).
 */
export type Acceso = 'todos' | 'admin' | 'cmc'

type Herramienta = {
  name: string
  title: string
  description: string
  acceso: Acceso
  /** Solo consulta: no cambia nada. Los clientes de IA lo usan para no pedir confirmación. */
  soloLectura: boolean
  /** Borra, rechaza o quita accesos: el cliente de IA debería pedir confirmación. */
  destructiva?: boolean
  parameters: z.ZodRawShape
  handler: (args: Record<string, unknown>, req: Ctx, extra: unknown) => Promise<Resultado>
}

const texto = (o: unknown): Resultado => ({ content: [{ type: 'text', text: typeof o === 'string' ? o : JSON.stringify(o, null, 2) }] })
const pedirConfirmacion = (accion: string) => texto(`CONFIRMACIÓN NECESARIA: ${accion}. Pregunte al usuario si está de acuerdo y, en ese caso, repita la llamada con confirmar=true.`)
const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string))
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleDateString('es-ES') : null)
const fmtHora = (d?: string | null) => (d ? new Date(d).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null)
const soloCMC = (req: Ctx) => {
  if (!esSuperAdmin(req.user)) throw new AppError('Esta acción solo la puede hacer CMC.', 403)
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
    condicionado: d.estadoManual === 'naranja' && d.estado !== 'naranja',
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

async function comprobarNombre(req: Ctx, tipo: TipoCatalogo, nombre: string, aceptar?: boolean, categoria?: string | number) {
  const s = await sugerir(req, tipo, nombre, categoria == null ? undefined : String(categoria))
  if (s.exacta || aceptar || !s.similares.length) return null
  return texto(`«${nombre}» no existe en el catálogo, pero hay nombres muy parecidos: ${s.similares.map((n) => `«${n}»`).join(', ')}. Use uno de ellos o repita con aceptarNombreNuevo=true para añadir el nuevo.`)
}

type Opciones = { title: string; acceso: Acceso; soloLectura?: boolean; destructiva?: boolean }

const h = (name: string, o: Opciones, description: string, parameters: z.ZodRawShape, fn: (a: any, req: Ctx) => Promise<unknown>): Herramienta => ({
  name,
  title: o.title,
  description,
  acceso: o.acceso,
  soloLectura: o.soloLectura ?? false,
  destructiva: o.destructiva,
  parameters,
  handler: async (args, req) => {
    try {
      if (!puedeUsar(req.user, o.acceso)) throw new AppError('No tiene permiso para usar esta herramienta.', 403)
      const r = await fn(args, req)
      return r && typeof r === 'object' && 'content' in r ? (r as Resultado) : texto(r)
    } catch (e) {
      return { ...texto(`Error: ${(e as Error).message}`), isError: true }
    }
  },
})

/** ¿Puede este usuario usar herramientas de este nivel? */
export function puedeUsar(user: User | null | undefined, acceso: Acceso) {
  if (!user) return false
  if (esSuperAdmin(user)) return true
  if (acceso === 'cmc') return false
  if (acceso === 'admin') return empresasDe(user, true).length > 0
  return empresasDe(user).length > 0
}

/** Herramientas que ve un usuario según su rol. */
export const herramientasPara = (user: User | null | undefined) => herramientas.filter((x) => puedeUsar(user, x.acceso))

/** Descripción del usuario para el asistente: quién es, su rol y en qué empresas. */
export async function perfilDe(user: User) {
  const cmc = esSuperAdmin(user)
  const { empresas } = await empresasDelUsuario(user, undefined)
  const roles = new Map((user.empresas ?? []).map((m) => [String(idDe(m.empresa)), m.rol]))
  return {
    nombre: user.nombre,
    email: user.email,
    rol: cmc ? 'CMC (super administrador): ve y gestiona todas las empresas' : empresasDe(user, true).length ? 'Administrador de empresa' : 'Usuario de empresa',
    empresas: cmc
      ? `Todas (${empresas.length} activas). Use mis_empresas para verlas.`
      : empresas.map((e) => ({ id: e.id, razonSocial: e.razonSocial, rol: roles.get(String(e.id)) === 'admin' ? 'administrador' : 'usuario' })),
  }
}

export const herramientas: Herramienta[] = [
  // ——— Consultas ———
  h('quien_soy', { title: 'Quién soy y qué puedo hacer', acceso: 'todos', soloLectura: true }, 'Usuario conectado, su rol (CMC, administrador o usuario de empresa), sus empresas y las herramientas que puede usar. Úsela al empezar para saber qué puede consultar o hacer.', {}, async (_a, req) => ({
    ...(await perfilDe(req.user!)),
    herramientas: herramientasPara(req.user).map((x) => x.name),
    portal: `${urlServidor()}/portal`,
  })),
  h('resumen', { title: 'Resumen del panel', acceso: 'todos', soloLectura: true }, 'Resumen como el panel del portal: documentos por estado, vencimientos a 30, 60 y 90 días, conversaciones pendientes de respuesta y, para CMC, envíos pendientes de revisar. Sin empresa: todas las accesibles.', { empresa: id.optional() }, async (a, req) => {
    if (a.empresa && !(await empresaVisible(req.user, a.empresa))) throw new AppError('No tiene acceso a esa empresa.', 403)
    const cmc = esSuperAdmin(req.user)
    const ids = a.empresa ? [a.empresa] : cmc ? null : empresasDe(req.user)
    const conteo = await conteoPorEmpresa(ids)
    const total = { verde: 0, amarillo: 0, naranja: 0, rojo: 0, azul: 0, negro: 0 }
    for (const c of Object.values(conteo)) for (const k of Object.keys(total) as Estado[]) total[k] += c[k]
    const extra = a.empresa ? 'AND empresa_id = $2' : ''
    const vence = async (dias: number) => {
      const limite = new Date(Date.now() + dias * 86_400_000).toISOString()
      const docs = await listarDocumentos(req.user, `AND estado NOT IN ('negro', 'azul', 'rojo') AND fecha_caducidad IS NOT NULL AND fecha_caducidad <= $1 ${extra}`, a.empresa ? [limite, Number(a.empresa)] : [limite], 2000)
      return docs.length
    }
    const [a30, a60, a90] = await Promise.all([vence(30), vence(60), vence(90)])
    return {
      ambito: a.empresa ? (await empresaPorId(a.empresa))?.razonSocial : cmc ? 'Todas las empresas' : 'Sus empresas',
      documentos: { vigentes: total.verde, caducidadProxima: total.amarillo, condicionados: total.naranja, caducados: total.rojo, noLegalizados: total.negro, archivados: total.azul },
      caducanEn: { '30 días': a30, '60 días': a60, '90 días': a90 },
      conversacionesPendientesDeMiRespuesta: await contarPendientesDeRespuesta(req.user!),
      conversacionesSinLeer: await contarNoLeidas(req.user!),
      ...(cmc ? { enviosPendientesDeRevisar: await contar('envios', "estado = 'pendiente'") } : {}),
    }
  }),
  h('ver_empresa', { title: 'Ficha de empresa', acceso: 'todos', soloLectura: true }, 'Datos de una empresa: CIF, dirección, contacto, modalidad de gestión, antelación de avisos y categorías. Los correos de aviso solo se muestran a sus administradores y a CMC.', { empresa: id }, async (a, req) => {
    const e = await empresaVisible(req.user, a.empresa)
    if (!e) throw new AppError('Empresa no encontrada.', 404)
    const admin = administraEmpresa(req.user, e.id)
    const cats = await categoriasDeEmpresa(e.id, { archivadas: false })
    return {
      id: e.id,
      razonSocial: e.razonSocial,
      cif: e.cif,
      direccion: e.direccion,
      sector: e.sector,
      contacto: e.contacto,
      gestion: e.gestion === 'no_gestionado' ? 'No gestionado' : 'Gestionado por CMC',
      antelacionAvisoMeses: e.antelacionMeses,
      activa: e.activa !== false,
      ...(admin ? { correosDeAviso: (e.emailsAviso ?? []).map((x) => x.email) } : {}),
      categorias: cats.map((c) => ({ id: c.id, nombre: c.nombre })),
    }
  }),
  h('listar_categorias', { title: 'Instalaciones de una empresa', acceso: 'todos', soloLectura: true }, 'Instalaciones (en los datos, «categorías») de una empresa con su modalidad de gestión y antelación de aviso. Útil para filtrar documentos o, en CMC, para crear uno.', { empresa: id, incluirArchivadas: z.boolean().optional() }, async (a, req) => {
    const e = await empresaVisible(req.user, a.empresa)
    if (!e) throw new AppError('Empresa no encontrada.', 404)
    const cats = await categoriasDeEmpresa(e.id, { archivadas: Boolean(a.incluirArchivadas) && esSuperAdmin(req.user) })
    return cats.map((c) => ({ id: c.id, nombre: c.nombre, descripcion: c.descripcion, gestion: resolverGestion(e.gestion, c.gestion) === 'gestionado' ? 'Gestionado por CMC' : 'No gestionado', antelacionMeses: c.antelacionMeses ?? e.antelacionMeses, archivada: Boolean(c.archivada) }))
  }),
  h('ver_envio', { title: 'Ficha de envío', acceso: 'todos', soloLectura: true }, 'Detalle de un envío a revisión: archivo, documento relacionado, estado, motivo de rechazo y enlace de descarga temporal (10 minutos).', { envio: id }, async (a, req) => {
    const e = await envioPorId(a.envio, req.user)
    if (!e) throw new AppError('Envío no encontrado.', 404)
    const doc = e.documentoRelacionado ? await documentoPorId(idDe(e.documentoRelacionado), req.user) : null
    return {
      id: e.id,
      titulo: e.titulo,
      empresa: (e.empresa as Empresa)?.razonSocial,
      estado: e.estado,
      enviado: fmtHora(e.createdAt),
      archivo: e.filename,
      tamano: tamano(e.filesize),
      relacion: e.relacion,
      documentoRelacionado: doc ? { id: doc.id, titulo: doc.titulo } : null,
      nuevaCaducidad: fmt(e.nuevaCaducidad),
      comentario: e.comentario,
      motivoRechazo: e.motivoRechazo,
      resuelto: fmtHora(e.resueltoEn ?? null),
      enlace: e.filename ? enlaceFirmado(req, { k: 'fichero', c: 'envios', i: String(e.id) }) : null,
    }
  }),
  h('personal_cmc', { title: 'Personal de CMC', acceso: 'cmc', soloLectura: true }, 'CMC: personas de CMC a las que se puede asignar una conversación (id y nombre).', {}, async () => usuariosCms()),
  h('mis_empresas', { title: 'Mis empresas y su semáforo', acceso: 'todos', soloLectura: true }, 'Empresas a las que tiene acceso el usuario, con el semáforo (documentos por estado y peor estado) de cada una.', {}, async (_a, req) => {
    const { empresas: docs } = await empresasDelUsuario(req.user!, undefined)
    const conteo = await conteoPorEmpresa(esSuperAdmin(req.user) ? null : empresasDe(req.user))
    return docs.map((e) => {
      const c = conteo[String(e.id)] ?? { verde: 0, amarillo: 0, naranja: 0, rojo: 0, azul: 0, negro: 0 }
      const estados = (Object.entries(c) as [Estado, number][]).filter(([, n]) => n > 0).map(([k]) => k)
      return { id: e.id, razonSocial: e.razonSocial, cif: e.cif, peorEstado: ESTADOS[peorEstado(estados)].label, vigentes: c.verde, caducidadProxima: c.amarillo, condicionados: c.naranja, caducados: c.rojo, archivados: c.azul, noLegalizados: c.negro }
    })
  }),
  h(
    'buscar_documentos',
    { title: 'Buscar documentos', acceso: 'todos', soloLectura: true },
    'Busca documentos por texto y filtros (empresa, categoría, estado, rango de fechas de caducidad). Estados: verde, amarillo (caducidad próxima), naranja (condicionada), rojo, azul (archivado), negro (no legalizado).',
    {
      texto: z.string().optional(),
      empresa: id.optional(),
      categoria: id.optional(),
      estados: z.array(z.enum(['verde', 'amarillo', 'naranja', 'rojo', 'azul', 'negro'])).optional(),
      caducaDesde: z.string().optional().describe('AAAA-MM-DD'),
      caducaHasta: z.string().optional().describe('AAAA-MM-DD'),
      limite: z.number().optional(),
    },
    async (a, req) => {
      const r = await buscarDocumentos(req, { q: a.texto, empresa: a.empresa, categoria: a.categoria, estados: a.estados, desde: a.caducaDesde, hasta: a.caducaHasta, limite: a.limite ?? 50 })
      return { total: r.totalDocs, documentos: (r.docs as Documento[]).map(resumenDoc) }
    },
  ),
  h('proximos_vencimientos', { title: 'Próximos vencimientos', acceso: 'todos', soloLectura: true }, 'Documentos que caducan en los próximos N días (30, 60, 90…), además de los caducados y condicionados. Sin empresa: todas las accesibles.', { dias: z.number().optional().describe('Por defecto 60'), empresa: id.optional() }, async (a, req) => {
    const limite = new Date(Date.now() + (a.dias ?? 60) * 86_400_000).toISOString()
    const extra = a.empresa ? 'AND empresa_id = $2' : ''
    const params = a.empresa ? [limite, Number(a.empresa)] : [limite]
    const docs = await listarDocumentos(req.user, `AND estado NOT IN ('negro', 'azul') AND (estado IN ('rojo', 'amarillo', 'naranja') OR fecha_caducidad <= $1) ${extra} ORDER BY fecha_caducidad`, params, 500)
    return docs.map(resumenDoc)
  }),
  h('ver_documento', { title: 'Ficha de documento', acceso: 'todos', soloLectura: true }, 'Ficha completa de un documento: datos, estado, modalidad de gestión, archivo vigente e histórico de archivos asociados.', { documento: id }, async (a, req) => {
    const d = await documentoPorId(a.documento, req.user)
    if (!d) throw new AppError('Documento no encontrado.', 404)
    const archivos = await archivosDeDocumento(d.id, req.user)
    return {
      ...resumenDoc(d),
      motivoEstado: d.motivoEstado,
      limiteSubsanacion: fmt(d.limiteSubsanacion),
      observaciones: d.observaciones,
      archivos: archivos.map((x) => ({ id: x.id, nombre: x.filename, relacion: x.relacion, vigente: !x.historico, subido: fmt(x.createdAt), tamano: tamano(x.filesize), comentario: x.comentario })),
    }
  }),
  h('enlace_descarga', { title: 'Enlace de descarga', acceso: 'todos', soloLectura: true }, 'Genera un enlace de descarga temporal (10 minutos) del archivo vigente de un documento o de un archivo concreto.', { documento: id.optional(), archivo: id.optional() }, async (a, req) => {
    let archivo = a.archivo
    if (!archivo && a.documento) {
      const d = await documentoPorId(a.documento, req.user)
      if (!d) throw new AppError('Documento no encontrado.', 404)
      archivo = idDe(d.archivoVigente)
      if (!archivo) throw new AppError('El documento no tiene archivo vigente.', 404)
    }
    if (!archivo) throw new AppError('Indique el documento o el archivo.', 400)
    // Comprobado aquí con los permisos del usuario, y otra vez al descargar.
    const reg = await archivoPorId(archivo, req.user)
    if (!reg) throw new AppError('Archivo no encontrado.', 404)
    return { archivo: reg.filename, enlace: enlaceFirmado(req, { k: 'fichero', c: 'archivos', i: String(reg.id) }), caducaEnMinutos: 10 }
  }),
  h('descargar_zip', { title: 'Descargar varios en ZIP', acceso: 'todos', soloLectura: true }, 'Enlace temporal para descargar en un ZIP el archivo vigente de varios documentos.', { documentos: z.array(id), conHistorico: z.boolean().optional() }, async (a, req) => ({
    enlace: enlaceFirmado(req, { k: 'zip', ids: a.documentos.map(String), h: a.conHistorico }),
    caducaEnMinutos: 10,
  })),
  h('exportar_inventario', { title: 'Exportar inventario', acceso: 'todos', soloLectura: true }, 'Enlace temporal al inventario documental de una empresa con su estado, en Excel o PDF.', { empresa: id, formato: z.enum(['xlsx', 'pdf']).optional() }, async (a, req) => ({
    enlace: enlaceFirmado(req, { k: 'inventario', e: String(a.empresa), f: a.formato ?? 'xlsx' }),
    caducaEnMinutos: 10,
  })),
  h('avisos', { title: 'Avisos y correos', acceso: 'todos', soloLectura: true }, 'Centro de notificaciones de una empresa: próximos avisos programados y correos enviados.', { empresa: id }, async (a, req) => {
    const r = await centroAvisos(req, a.empresa)
    return {
      proximos: r.proximos.map((p) => ({ fecha: fmt(p.fecha), tipo: p.tipo, documento: p.documento.titulo, documentoId: p.documento.id, gestionado: p.gestionado })),
      enviados: r.enviados.map((c) => ({ fecha: fmt(c.createdAt), asunto: c.asunto, para: c.para, estado: c.estado })),
    }
  }),
  h('listar_envios', { title: 'Envíos a revisión', acceso: 'todos', soloLectura: true }, 'Envíos de documentos a revisión y su estado (pendiente, publicado, rechazado). CMC ve la bandeja de todas las empresas.', { empresa: id.optional(), estado: z.enum(['pendiente', 'publicado', 'rechazado']).optional() }, async (a, req) => {
    const cond: string[] = []
    const params: unknown[] = []
    if (a.empresa) { params.push(Number(a.empresa)); cond.push(`empresa_id = $${params.length}`) }
    if (a.estado) { params.push(a.estado); cond.push(`estado = $${params.length}`) }
    const docs = await listarEnvios(req.user, `${cond.length ? `AND ${cond.join(' AND ')} ` : ''}ORDER BY created_at DESC`, params, 100)
    return (docs as Envio[]).map((e) => ({ id: e.id, titulo: e.titulo, empresa: (e.empresa as Empresa)?.razonSocial, estado: e.estado, enviado: fmt(e.createdAt), archivo: e.filename, relacion: e.relacion, nuevaCaducidad: fmt(e.nuevaCaducidad), comentario: e.comentario, motivoRechazo: e.motivoRechazo }))
  }),
  h(
    'listar_conversaciones',
    { title: 'Conversaciones', acceso: 'todos', soloLectura: true },
    'Conversaciones de Comunicación (cliente y CMC), de la más reciente a la más antigua, con el último mensaje y los mensajes sin leer. «pendienteDeMiRespuesta» indica que el último mensaje es del otro lado. Filtros: empresa, estado, texto (asunto o mensajes), soloPendientes y, para CMC, soloMias (asignadas a mí).',
    { empresa: id.optional(), estado: z.enum(['abierto', 'resuelto']).optional(), texto: z.string().optional(), soloPendientes: z.boolean().optional(), soloMias: z.boolean().optional(), limite: z.number().optional() },
    async (a, req) => {
      const cmc = esSuperAdmin(req.user)
      const cond: string[] = []
      const params: unknown[] = []
      const p = (v: unknown) => {
        params.push(v)
        return `$${params.length}`
      }
      if (a.empresa) cond.push(`empresa_id = ${p(Number(a.empresa))}`)
      if (a.estado) cond.push(`estado = ${p(a.estado)}`)
      if (a.soloMias && cmc) cond.push(`asignado_id = ${p(req.user!.id)}`)
      if (a.texto?.trim()) {
        const t = p(`%${a.texto.trim().toLowerCase()}%`)
        cond.push(`(LOWER(asunto) LIKE ${t} OR EXISTS (SELECT 1 FROM mensajes mb WHERE mb.hilo_id = hilos.id AND LOWER(mb.texto) LIKE ${t}))`)
      }
      const docs = await listarHilos(req.user, `${cond.length ? `AND ${cond.join(' AND ')} ` : ''}ORDER BY ultimo_mensaje DESC LIMIT ${Math.min(Number(a.limite) || 50, 200)}`, params)
      const [ultimos, sinLeer] = await Promise.all([ultimosMensajes(docs.map((x) => x.id)), noLeidos(req.user!.id, docs.map((x) => x.id))])
      const lista = docs.map((x) => {
        const u = ultimos.get(x.id)
        const pendiente = Boolean(x.estado !== 'resuelto' && u && (cmc ? !u.deCmc : u.deCmc))
        return {
          id: x.id,
          asunto: x.asunto,
          empresa: (x.empresa as Empresa)?.razonSocial,
          empresaId: idDe(x.empresa),
          estado: x.estado,
          sobre: typeof x.documento === 'object' && x.documento ? `Documento ${x.documento.id}: ${x.documento.titulo}` : typeof x.categoria === 'object' && x.categoria ? `Instalación: ${x.categoria.nombre}` : 'General',
          asignadoA: typeof x.asignado === 'object' && x.asignado ? x.asignado.nombre : null,
          mensajes: u?.total ?? 0,
          ultimoMensaje: u ? { fecha: fmtHora(u.fecha), autor: u.deCmc ? `${u.autor ?? 'CMC'} (CMC)` : u.autor, texto: u.texto.slice(0, 300) } : null,
          pendienteDeMiRespuesta: pendiente,
          mensajesSinLeer: sinLeer.get(x.id) ?? 0,
        }
      })
      return a.soloPendientes ? lista.filter((x) => x.pendienteDeMiRespuesta) : lista
    },
  ),
  h('ver_conversacion', { title: 'Leer conversación', acceso: 'todos', soloLectura: true }, 'Todos los mensajes de una conversación, en orden, con autor, fecha y adjuntos (con enlace de descarga temporal de 10 minutos). La marca como leída.', { conversacion: id }, async (a, req) => {
    const hilo = await hiloPorId(a.conversacion, req.user)
    if (!hilo) throw new AppError('Conversación no encontrada.', 404)
    const docs = await mensajesDeHilo(hilo.id)
    await marcarLeido(hilo.id, req.user!.id)
    return {
      id: hilo.id,
      asunto: hilo.asunto,
      empresa: (hilo.empresa as Empresa)?.razonSocial,
      estado: hilo.estado,
      asignadoA: typeof hilo.asignado === 'object' && hilo.asignado ? hilo.asignado.nombre : null,
      documento: typeof hilo.documento === 'object' && hilo.documento ? { id: hilo.documento.id, titulo: hilo.documento.titulo } : null,
      enlace: `${urlServidor()}/portal/mensajes/${hilo.id}`,
      mensajes: docs.map((m) => {
        const autor = typeof m.autor === 'object' && m.autor ? m.autor : null
        return {
          fecha: fmtHora(m.createdAt),
          autor: autor ? `${autor.nombre}${autor.rol === 'superadmin' ? ' (CMC)' : ''}` : 'Usuario',
          texto: m.texto,
          adjuntos: (m.adjuntos ?? [])
            .filter((x): x is Adjunto => typeof x === 'object')
            .map((x) => ({ id: x.id, nombre: x.filename, tamano: tamano(x.filesize), enlace: enlaceFirmado(req, { k: 'fichero', c: 'adjuntos', i: String(x.id) }) })),
        }
      }),
    }
  }),
  h('usuarios_de_empresa', { title: 'Usuarios de una empresa', acceso: 'admin', soloLectura: true }, 'Usuarios de una empresa y su rol (solo administradores de esa empresa y CMC).', { empresa: id }, async (a, req) => usuariosDeEmpresa(req, a.empresa)),
  h('registro_actividad', { title: 'Registro de actividad', acceso: 'admin', soloLectura: true }, 'Registro de actividad (accesos, subidas, descargas, cambios de estado, correos). CMC: todo; administrador de empresa: las empresas que administra y sus propios accesos.', { empresa: id.optional(), accion: z.string().optional(), desde: z.string().optional().describe('AAAA-MM-DD'), hasta: z.string().optional().describe('AAAA-MM-DD'), limite: z.number().optional() }, async (a, req) => {
    if (a.empresa && !administraEmpresa(req.user, a.empresa)) throw new AppError('No administra esa empresa.', 403)
    const cond: string[] = []
    const params: unknown[] = []
    const p = (v: unknown) => {
      params.push(v)
      return `$${params.length}`
    }
    if (a.empresa) cond.push(`empresa_id = ${p(Number(a.empresa))}`)
    if (a.accion) cond.push(`accion = ${p(a.accion)}`)
    const desde = fechaValida(a.desde)
    const hasta = fechaValida(a.hasta, 'T23:59:59')
    if (desde) cond.push(`created_at >= ${p(desde)}`)
    if (hasta) cond.push(`created_at <= ${p(hasta)}`)
    const docs = await listarActividad(req.user, cond.length ? `AND ${cond.join(' AND ')}` : '', params, Math.min(a.limite ?? 50, 500))
    return docs.map((x) => ({ fecha: fmtHora(x.createdAt), accion: x.accion, descripcion: x.descripcion, usuario: x.email, origen: x.origen }))
  }),
  h('buscar_nombre_catalogo', { title: 'Buscar en el catálogo de nombres', acceso: 'todos', soloLectura: true }, 'Busca en los catálogos de nombres (categoria, documento, relacion) antes de crear uno nuevo, sin distinguir mayúsculas ni acentos. Con categoría, prioriza los nombres de documento ya usados en ella.', { tipo: z.enum(['categoria', 'documento', 'relacion']), texto: z.string().optional(), categoria: id.optional() }, async (a, req) => sugerir(req, a.tipo, a.texto ?? '', a.categoria == null ? undefined : String(a.categoria))),
  h('almacenamiento', { title: 'Almacenamiento', acceso: 'cmc', soloLectura: true }, 'Almacenamiento consumido, total y por empresa (solo CMC).', {}, async (_a, req) => {
    soloCMC(req)
    const u = await almacenamiento()
    return { total: tamano(u.total), ficheros: tamano(u.ficheros), baseDeDatos: tamano(u.bd), porEmpresa: Object.fromEntries(Object.entries(u.porEmpresa).map(([k, v]) => [k, tamano(v)])) }
  }),

  // ——— Acciones del cliente (y de CMC) ———
  h(
    'enviar_documento_a_cmc',
    { title: 'Enviar documento a CMC', acceso: 'todos' },
    'Envía un documento a CMC para su revisión (los usuarios de empresa no publican directamente). Para una renovación, indique el documento al que se refiere.',
    { empresa: id, titulo: z.string(), documento: id.optional(), relacion: z.string().optional().describe('Renovación, Subsanación, Anexo…'), nuevaCaducidad: z.string().optional().describe('AAAA-MM-DD'), comentario: z.string().optional(), ...fichero },
    async (a, req) => {
      const file = ficheroDe(a)
      if (!file) throw new AppError('Adjunte el archivo (nombreArchivo y contenidoBase64).', 400)
      const e = await crearEnvio(req, { titulo: a.titulo, empresa: Number(a.empresa), documentoRelacionado: a.documento ? Number(a.documento) : null, relacion: a.relacion ?? (a.documento ? 'Renovación' : 'Original'), nuevaCaducidad: a.nuevaCaducidad, comentario: a.comentario }, file)
      if (!e) throw new AppError('No se ha podido registrar el envío.', 500)
      return `Enviado a CMC para revisión (envío ${e.id}). Estado: pendiente.`
    },
  ),
  h(
    'escribir_mensaje',
    { title: 'Escribir mensaje', acceso: 'todos' },
    'Escribe en Comunicación: responde en una conversación existente o abre una nueva (empresa + asunto, opcionalmente sobre un documento). Puede adjuntar un archivo. Los usuarios de empresa escriben a CMC; CMC escribe a la empresa. Se avisa por correo a los participantes.',
    { conversacion: id.optional(), empresa: id.optional(), asunto: z.string().optional(), documento: id.optional(), texto: z.string(), ...fichero },
    async (a, req) => {
      const file = ficheroDe(a)
      let empresa = a.empresa
      if (a.conversacion) {
        const hilo = await hiloPorId(a.conversacion, req.user)
        if (!hilo) throw new AppError('Conversación no encontrada.', 404)
        empresa = idDe(hilo.empresa)
      }
      const adjuntos = file && empresa ? [(await subirAdjunto(req, empresa, file)).id] : []
      if (a.conversacion) {
        await escribirMensaje(req, { hilo: a.conversacion, texto: a.texto, adjuntos })
        return `Mensaje enviado en la conversación ${a.conversacion}.`
      }
      if (!a.empresa || !a.asunto) throw new AppError('Para una conversación nueva indique empresa y asunto.', 400)
      const hilo = await crearHilo(req, { empresa: a.empresa, asunto: a.asunto, documento: a.documento, texto: a.texto, adjuntos })
      if (!hilo) throw new AppError('No se ha podido crear la conversación.', 500)
      return `Conversación ${hilo.id} creada y mensaje enviado: ${urlServidor()}/portal/mensajes/${hilo.id}`
    },
  ),
  h('dar_de_alta_usuario', { title: 'Dar acceso a un usuario', acceso: 'admin' }, 'Da acceso a un usuario en una empresa (administrador de empresa o CMC). Si el email ya existe, se le añade la empresa.', { empresa: id, email: z.string(), nombre: z.string().optional(), rol: z.enum(['admin', 'usuario']).optional() }, async (a, req) => {
    const r = await invitarUsuario(req, { empresa: a.empresa, email: a.email, nombre: a.nombre, rol: a.rol ?? 'usuario' })
    return r.creado ? `Usuario creado; se le ha enviado la invitación a ${a.email}.` : `${a.email} ya existía: se le ha dado acceso a la empresa.`
  }),
  h('quitar_acceso_usuario', { title: 'Quitar acceso a un usuario', acceso: 'admin', destructiva: true }, 'Retira el acceso de un usuario a una empresa (si se queda sin empresas, se da de baja).', { usuario: id, empresa: id, confirmar }, async (a, req) => {
    if (!a.confirmar) return pedirConfirmacion(`retirar el acceso del usuario ${a.usuario} a la empresa ${a.empresa}`)
    await quitarAcceso(req, { usuario: a.usuario, empresa: a.empresa })
    return 'Acceso retirado.'
  }),
  h('cambiar_rol_usuario', { title: 'Cambiar rol de usuario', acceso: 'admin' }, 'Cambia el rol (admin/usuario) de un usuario en una empresa.', { usuario: id, empresa: id, rol: z.enum(['admin', 'usuario']), confirmar }, async (a, req) => {
    if (!a.confirmar) return pedirConfirmacion(`cambiar el rol del usuario ${a.usuario} a ${a.rol}`)
    await cambiarRol(req, a)
    return 'Rol cambiado.'
  }),

  // ——— Acciones de CMC ———
  h(
    'alta_empresa',
    { title: 'Alta de empresa', acceso: 'cmc' },
    'CMC: da de alta una empresa cliente y su administrador (recibe una invitación por correo). Aplica la plantilla de categorías estándar.',
    { razonSocial: z.string(), cif: z.string(), direccion: z.string().optional(), sector: z.string().optional(), contacto: z.string().optional(), emailsAviso: z.array(z.string()).optional(), gestion: z.enum(['gestionado', 'no_gestionado']).optional(), adminEmail: z.string(), adminNombre: z.string().optional(), aplicarPlantilla: z.boolean().optional(), confirmar },
    async (a, req) => {
      soloCMC(req)
      if (!a.confirmar) return pedirConfirmacion(`dar de alta la empresa «${a.razonSocial}» (${a.cif}) con administrador ${a.adminEmail}`)
      const e = await crearEmpresa(req, { razonSocial: a.razonSocial, cif: a.cif, direccion: a.direccion, sector: a.sector, contacto: a.contacto, emailsAviso: (a.emailsAviso ?? []).map((email: string) => ({ email })), gestion: a.gestion, adminEmail: a.adminEmail, adminNombre: a.adminNombre, aplicarPlantilla: a.aplicarPlantilla ?? true })
      return `Empresa ${e.id} creada. Invitación enviada a ${a.adminEmail}.`
    },
  ),
  h('baja_o_reactivacion_empresa', { title: 'Baja o reactivación de empresa', acceso: 'cmc', destructiva: true }, 'CMC: baja lógica (bloquea los accesos, conserva el histórico) o reactivación de una empresa.', { empresa: id, activa: z.boolean(), confirmar }, async (a, req) => {
    soloCMC(req)
    const e = await empresaPorId(a.empresa)
    if (!e) throw new AppError('Empresa no encontrada.', 404)
    if (!a.confirmar) return pedirConfirmacion(`${a.activa ? 'reactivar' : 'dar de baja'} la empresa «${e.razonSocial}»`)
    await actualizarEmpresa(req, e.id, { activa: a.activa })
    return a.activa ? 'Empresa reactivada.' : 'Empresa dada de baja.'
  }),
  h('crear_categoria', { title: 'Crear instalación', acceso: 'cmc' }, 'CMC: crea una instalación (categoría) en una empresa. Comprueba el catálogo de nombres antes de añadir uno nuevo.', { empresa: id, nombre: z.string(), antelacionMeses: z.number().optional(), gestion: z.enum(['gestionado', 'no_gestionado']).optional(), descripcion: z.string().optional(), aceptarNombreNuevo: z.boolean().optional() }, async (a, req) => {
    soloCMC(req)
    const aviso = await comprobarNombre(req, 'categoria', a.nombre, a.aceptarNombreNuevo)
    if (aviso) return aviso
    const c = await uno<{ id: number }>(
      `INSERT INTO categorias (nombre, empresa_id, descripcion, antelacion_meses, gestion, orden, archivada, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,0,$6,$7,$7) RETURNING id`,
      [a.nombre, Number(a.empresa), a.descripcion ?? null, a.antelacionMeses ?? null, a.gestion ?? null, bit(false), ahora()],
    )
    await registrar(req, { accion: 'alta', descripcion: `Instalación «${a.nombre}» creada`, empresa: a.empresa, coleccion: 'categorias', registroId: c!.id })
    return `Instalación ${c!.id} creada.`
  }),
  h(
    'crear_documento',
    { title: 'Crear documento', acceso: 'cmc' },
    'CMC: publica un documento nuevo (opcionalmente con su archivo original). La fecha de aviso se propone sola si no se indica.',
    { empresa: id, categoria: id, titulo: z.string(), referencia: z.string().optional(), organismo: z.string().optional(), fechaEmision: z.string().optional(), fechaCaducidad: z.string().optional(), fechaAviso: z.string().optional(), gestion: z.enum(['gestionado', 'no_gestionado']).optional(), aceptarNombreNuevo: z.boolean().optional(), ...fichero },
    async (a, req) => {
      soloCMC(req)
      const aviso = await comprobarNombre(req, 'documento', a.titulo, a.aceptarNombreNuevo, a.categoria)
      if (aviso) return aviso
      const d = await crearDocumento(req, { empresa: Number(a.empresa), categoria: Number(a.categoria), titulo: a.titulo, referencia: a.referencia, organismo: a.organismo, fechaEmision: a.fechaEmision, fechaCaducidad: a.fechaCaducidad, fechaAviso: a.fechaAviso, gestion: a.gestion })
      const file = ficheroDe(a)
      if (file) await crearArchivo(req, { documento: d.id, relacion: 'Original' }, file)
      return { documento: resumenDoc((await documentoPorId(d.id, req.user))!) }
    },
  ),
  h(
    'editar_documento',
    { title: 'Editar documento', acceso: 'cmc' },
    'CMC: edita los metadatos de un documento o lo mueve de categoría (queda registrado).',
    { documento: id, titulo: z.string().optional(), categoria: id.optional(), referencia: z.string().optional(), organismo: z.string().optional(), fechaEmision: z.string().optional(), fechaCaducidad: z.string().nullable().optional(), fechaAviso: z.string().optional(), observaciones: z.string().optional(), confirmar },
    async (a, req) => {
      soloCMC(req)
      const { documento, confirmar: ok, ...campos } = a
      if (campos.categoria && !ok) return pedirConfirmacion(`mover el documento ${documento} a la categoría ${campos.categoria}`)
      if (campos.categoria) campos.categoria = Number(campos.categoria)
      const d = await actualizarDocumento(req, documento, campos)
      return resumenDoc(d)
    },
  ),
  h(
    'asociar_archivo',
    { title: 'Asociar archivo a documento', acceso: 'cmc' },
    'CMC: asocia un archivo nuevo a un documento existente (renovación, subsanación, anexo o un tipo nuevo, indicando su efecto). Si sustituye al vigente, el anterior pasa al histórico.',
    { documento: id, relacion: z.string(), efectos: z.array(z.enum(['sustituye', 'actualiza_fechas', 'levanta', 'complementario'])).optional(), nuevaCaducidad: z.string().optional(), nuevoAviso: z.string().optional(), comentario: z.string().optional(), aceptarNombreNuevo: z.boolean().optional(), ...fichero },
    async (a, req) => {
      soloCMC(req)
      const file = ficheroDe(a)
      if (!file) throw new AppError('Adjunte el archivo (nombreArchivo y contenidoBase64).', 400)
      const aviso = await comprobarNombre(req, 'relacion', a.relacion, a.aceptarNombreNuevo)
      if (aviso) return aviso
      await crearArchivo(req, { documento: Number(a.documento), relacion: a.relacion, efectos: a.efectos, nuevaCaducidad: a.nuevaCaducidad, nuevoAviso: a.nuevoAviso, comentario: a.comentario }, file)
      return resumenDoc((await documentoPorId(a.documento, req.user))!)
    },
  ),
  h(
    'publicar_envio',
    { title: 'Publicar envío', acceso: 'cmc' },
    'CMC: publica un envío recibido, en un documento existente (documentoDestino) o como documento nuevo (categoria + fechas).',
    { envio: id, documentoDestino: id.optional(), categoria: id.optional(), titulo: z.string().optional(), relacion: z.string().optional(), fechaEmision: z.string().optional(), fechaCaducidad: z.string().optional(), fechaAviso: z.string().optional(), confirmar },
    async (a, req) => {
      soloCMC(req)
      const e = await envioPorId(a.envio, req.user)
      if (!e) throw new AppError('Envío no encontrado.', 404)
      if (!a.confirmar) return pedirConfirmacion(`publicar el envío «${e.titulo}» ${a.documentoDestino ? `en el documento ${a.documentoDestino}` : 'como documento nuevo'}`)
      await resolverEnvio(req, e.id, { estado: 'publicado', documentoDestino: a.documentoDestino ? Number(a.documentoDestino) : null, categoriaDestino: a.categoria ? Number(a.categoria) : null, tituloFinal: a.titulo, relacionFinal: a.relacion, fechaEmision: a.fechaEmision, fechaCaducidad: a.fechaCaducidad, fechaAviso: a.fechaAviso })
      return 'Envío publicado. Se ha avisado al usuario que lo envió.'
    },
  ),
  h('rechazar_envio', { title: 'Rechazar envío', acceso: 'cmc', destructiva: true }, 'CMC: rechaza un envío recibido indicando el motivo (se avisa al usuario).', { envio: id, motivo: z.string(), confirmar }, async (a, req) => {
    soloCMC(req)
    if (!a.confirmar) return pedirConfirmacion(`rechazar el envío ${a.envio} con el motivo «${a.motivo}»`)
    await resolverEnvio(req, a.envio, { estado: 'rechazado', motivoRechazo: a.motivo })
    return 'Envío rechazado.'
  }),
  h(
    'cambiar_estado_manual',
    { title: 'Cambiar estado manual', acceso: 'cmc' },
    'CMC: fija un estado manual (naranja = condicionada, rojo = revocada, azul = pasado o archivado, negro = no legalizado) con su motivo, o lo quita (ninguno).',
    { documento: id, estado: z.enum(['naranja', 'rojo', 'azul', 'negro', 'ninguno']), motivo: z.string().optional(), limiteSubsanacion: z.string().optional(), confirmar },
    async (a, req) => {
      soloCMC(req)
      if (a.estado !== 'ninguno' && !a.motivo) throw new AppError('Indique el motivo.', 400)
      if (!a.confirmar) return pedirConfirmacion(`cambiar el estado manual del documento ${a.documento} a «${a.estado}»`)
      const d = await actualizarDocumento(req, a.documento, { estadoManual: a.estado === 'ninguno' ? null : a.estado, motivoEstado: a.estado === 'ninguno' ? null : a.motivo, limiteSubsanacion: a.limiteSubsanacion })
      return resumenDoc(d)
    },
  ),
  h(
    'cambiar_modalidad_gestion',
    { title: 'Cambiar modalidad de gestión', acceso: 'cmc' },
    'CMC: marca una empresa, categoría o documento como Gestionado / No gestionado, o lo deja heredar del nivel superior.',
    { nivel: z.enum(['empresa', 'categoria', 'documento']), id, gestion: z.enum(['gestionado', 'no_gestionado', 'heredar']), confirmar },
    async (a, req) => {
      soloCMC(req)
      if (!a.confirmar && a.nivel !== 'documento') return pedirConfirmacion(`cambiar la modalidad de ${a.nivel} ${a.id} a «${a.gestion}» (afecta a todos sus documentos que no tengan modalidad propia)`)
      const gestion = a.gestion === 'heredar' ? null : a.gestion
      if (a.nivel === 'empresa') await actualizarEmpresa(req, a.id, { gestion })
      else if (a.nivel === 'categoria') await actualizarCategoria(req, a.id, { gestion })
      else await actualizarDocumento(req, a.id, { gestion })
      return 'Modalidad actualizada.'
    },
  ),
  h('gestionar_conversacion', { title: 'Gestionar conversación', acceso: 'cmc' }, 'CMC: marca una conversación como abierta o resuelta y/o la asigna a una persona de CMC.', { conversacion: id, estado: z.enum(['abierto', 'resuelto']).optional(), asignado: id.optional() }, async (a, req) => {
    soloCMC(req)
    await gestionarHilo(req, a.conversacion, { ...(a.estado ? { estado: a.estado } : {}), ...(a.asignado ? { asignado: Number(a.asignado) } : {}) })
    return 'Conversación actualizada.'
  }),
  h('exportar_comunicaciones', { title: 'Exportar comunicaciones', acceso: 'todos', soloLectura: true }, 'Enlace temporal al historial de comunicaciones (PDF) de una empresa o de un documento.', { empresa: id, documento: id.optional() }, async (a, req) => ({
    enlace: enlaceFirmado(req, { k: 'historial', e: String(a.empresa), d: a.documento ? String(a.documento) : undefined }),
    caducaEnMinutos: 10,
  })),
]
