import { esSuperAdmin, empresasDe } from '@/access'
import { bool, esPostgres, jsonValor, num } from '@/lib/db'
import type { Actividad, Adjunto, Archivo, Catalogo, Categoria, Correo, Documento, Empresa, Envio, Hilo, Media, Mensaje, Servicio, Trabajo, User } from './tipos'

type Fila = Record<string, unknown>

const txt = (v: unknown) => (v == null ? null : String(v))
const fecha = (v: unknown) => (v == null || v === '' ? null : v instanceof Date ? v.toISOString() : String(v))
const entero = (v: unknown) => (v == null || v === '' ? null : Number(v))

export const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? String((v as { id: number | string }).id) : v == null ? '' : String(v))

/** Fragmento SQL que limita una columna de empresa a las que el usuario puede ver. */
export function visible(user: User | null, columna = 'empresa_id') {
  if (!user) return 'FALSE'
  if (esSuperAdmin(user)) return 'TRUE'
  const ids = empresasDe(user).map((id) => Number(id)).filter((n) => Number.isFinite(n))
  if (!ids.length) return 'FALSE'
  const activa = esPostgres ? 'true' : '1'
  return `${columna} IN (${ids.join(',')}) AND EXISTS (SELECT 1 FROM empresas ev WHERE ev.id = ${columna} AND ev.activa = ${activa})`
}

export function mapMedia(r: Fila): Media {
  return {
    id: Number(r.id),
    alt: String(r.alt ?? ''),
    url: txt(r.url),
    thumbnailURL: txt(r.thumbnail_u_r_l),
    filename: txt(r.filename),
    mimeType: txt(r.mime_type),
    filesize: num(r.filesize),
    width: num(r.width),
    height: num(r.height),
    focalX: num(r.focal_x),
    focalY: num(r.focal_y),
    updatedAt: fecha(r.updated_at) ?? '',
    createdAt: fecha(r.created_at) ?? '',
  }
}

export function mapEmpresa(r: Fila, emails: { email: string; id?: string }[] = []): Empresa {
  return {
    id: Number(r.id),
    razonSocial: String(r.razon_social ?? ''),
    cif: String(r.cif ?? ''),
    direccion: txt(r.direccion),
    sector: txt(r.sector),
    logo: entero(r.logo_id),
    contacto: txt(r.contacto),
    emailsAviso: emails,
    gestion: (r.gestion as Empresa['gestion']) ?? null,
    antelacionMeses: num(r.antelacion_meses),
    tecnico: entero(r.tecnico_id),
    activa: r.activa == null ? true : bool(r.activa),
    updatedAt: fecha(r.updated_at) ?? '',
    createdAt: fecha(r.created_at) ?? '',
  }
}

export function mapUser(r: Fila, empresas: NonNullable<User['empresas']> = [], secreto = false): User {
  return {
    id: Number(r.id),
    nombre: String(r.nombre ?? ''),
    rol: r.rol === 'superadmin' ? 'superadmin' : 'cliente',
    empresas,
    recibeAvisos: bool(r.recibe_avisos),
    activo: r.activo == null ? true : bool(r.activo),
    totpActivo: bool(r.totp_activo),
    ...(secreto
      ? {
          totpSecreto: txt(r.totp_secreto),
          totpPendiente: txt(r.totp_pendiente),
          totpUltimoPaso: num(r.totp_ultimo_paso),
          invitacionHash: txt(r.invitacion_hash),
          salt: txt(r.salt),
          hash: txt(r.hash),
          resetPasswordToken: txt(r.reset_password_token),
          resetPasswordExpiration: fecha(r.reset_password_expiration),
          loginAttempts: num(r.login_attempts) ?? 0,
          lockUntil: fecha(r.lock_until),
        }
      : {}),
    email: String(r.email ?? ''),
    updatedAt: fecha(r.updated_at) ?? '',
    createdAt: fecha(r.created_at) ?? '',
    collection: 'users',
  }
}

export function mapCategoria(r: Fila): Categoria {
  return {
    id: Number(r.id),
    nombre: String(r.nombre ?? ''),
    empresa: Number(r.empresa_id),
    descripcion: txt(r.descripcion),
    antelacionMeses: num(r.antelacion_meses),
    gestion: (r.gestion as Categoria['gestion']) ?? null,
    responsable: entero(r.responsable_id),
    orden: num(r.orden) ?? 0,
    archivada: bool(r.archivada),
    updatedAt: fecha(r.updated_at) ?? '',
    createdAt: fecha(r.created_at) ?? '',
  }
}

export function mapDocumento(r: Fila): Documento {
  return {
    id: Number(r.id),
    titulo: String(r.titulo ?? ''),
    empresa: Number(r.empresa_id),
    categoria: Number(r.categoria_id),
    referencia: txt(r.referencia),
    organismo: txt(r.organismo),
    fechaEmision: fecha(r.fecha_emision),
    fechaCaducidad: fecha(r.fecha_caducidad),
    fechaAviso: fecha(r.fecha_aviso),
    avisoManual: bool(r.aviso_manual),
    estado: (r.estado as Documento['estado']) ?? null,
    estadoManual: (r.estado_manual as Documento['estadoManual']) ?? null,
    motivoEstado: txt(r.motivo_estado),
    limiteSubsanacion: fecha(r.limite_subsanacion),
    gestion: (r.gestion as Documento['gestion']) ?? null,
    tecnico: entero(r.tecnico_id),
    archivoVigente: entero(r.archivo_vigente_id),
    observaciones: txt(r.observaciones),
    updatedAt: fecha(r.updated_at) ?? '',
    createdAt: fecha(r.created_at) ?? '',
  }
}

const fichero = (r: Fila) => ({
  url: txt(r.url),
  filename: txt(r.filename),
  mimeType: txt(r.mime_type),
  filesize: num(r.filesize),
  width: num(r.width),
  height: num(r.height),
  updatedAt: fecha(r.updated_at) ?? '',
  createdAt: fecha(r.created_at) ?? '',
})

export function mapArchivo(r: Fila, efectos: Archivo['efectos'] = []): Archivo {
  return {
    id: Number(r.id),
    documento: Number(r.documento_id),
    empresa: entero(r.empresa_id),
    relacion: String(r.relacion ?? 'Original'),
    efectos,
    nuevaCaducidad: fecha(r.nueva_caducidad),
    nuevoAviso: fecha(r.nuevo_aviso),
    comentario: txt(r.comentario),
    historico: bool(r.historico),
    tamanoOriginal: num(r.tamano_original),
    subidoPor: entero(r.subido_por_id),
    ...fichero(r),
  }
}

export function mapEnvio(r: Fila): Envio {
  return {
    id: Number(r.id),
    titulo: String(r.titulo ?? ''),
    empresa: Number(r.empresa_id),
    documentoRelacionado: entero(r.documento_relacionado_id),
    relacion: txt(r.relacion),
    nuevaCaducidad: fecha(r.nueva_caducidad),
    comentario: txt(r.comentario),
    estado: (r.estado as Envio['estado']) ?? 'pendiente',
    documentoDestino: entero(r.documento_destino_id),
    relacionFinal: txt(r.relacion_final),
    categoriaDestino: entero(r.categoria_destino_id),
    tituloFinal: txt(r.titulo_final),
    fechaEmision: fecha(r.fecha_emision),
    fechaCaducidad: fecha(r.fecha_caducidad),
    fechaAviso: fecha(r.fecha_aviso),
    motivoRechazo: txt(r.motivo_rechazo),
    tamanoOriginal: num(r.tamano_original),
    enviadoPor: entero(r.enviado_por_id),
    resueltoPor: entero(r.resuelto_por_id),
    resueltoEn: fecha(r.resuelto_en),
    ...fichero(r),
  }
}

export function mapHilo(r: Fila): Hilo {
  return {
    id: Number(r.id),
    asunto: String(r.asunto ?? ''),
    empresa: Number(r.empresa_id),
    categoria: entero(r.categoria_id),
    documento: entero(r.documento_id),
    estado: (r.estado as Hilo['estado']) ?? 'abierto',
    asignado: entero(r.asignado_id),
    creadoPor: entero(r.creado_por_id),
    ultimoMensaje: fecha(r.ultimo_mensaje),
    updatedAt: fecha(r.updated_at) ?? '',
    createdAt: fecha(r.created_at) ?? '',
  }
}

export function mapMensaje(r: Fila): Mensaje {
  return {
    id: Number(r.id),
    hilo: Number(r.hilo_id),
    texto: String(r.texto ?? ''),
    empresa: entero(r.empresa_id),
    autor: entero(r.autor_id),
    updatedAt: fecha(r.updated_at) ?? '',
    createdAt: fecha(r.created_at) ?? '',
  }
}

export function mapAdjunto(r: Fila): Adjunto {
  return {
    id: Number(r.id),
    empresa: Number(r.empresa_id),
    subidoPor: entero(r.subido_por_id),
    tamanoOriginal: num(r.tamano_original),
    ...fichero(r),
  }
}

export function mapCatalogo(r: Fila, efectos: Catalogo['efectos'] = []): Catalogo {
  return {
    id: Number(r.id),
    tipo: r.tipo as Catalogo['tipo'],
    nombre: String(r.nombre ?? ''),
    efectos,
    usos: num(r.usos) ?? 0,
    activo: r.activo == null ? true : bool(r.activo),
    fusionarEn: entero(r.fusionar_en_id),
    normalizado: txt(r.normalizado),
    updatedAt: fecha(r.updated_at) ?? '',
    createdAt: fecha(r.created_at) ?? '',
  }
}

export function mapCorreo(r: Fila): Correo {
  return {
    id: Number(r.id),
    asunto: String(r.asunto ?? ''),
    para: String(r.para ?? ''),
    usuario: entero(r.usuario_id),
    destinatario: (r.destinatario as Correo['destinatario']) ?? 'cliente',
    estado: (r.estado as Correo['estado']) ?? 'pendiente',
    plantilla: txt(r.plantilla),
    texto: txt(r.texto),
    empresa: entero(r.empresa_id),
    documento: entero(r.documento_id),
    hilo: entero(r.hilo_id),
    idempotencia: txt(r.idempotencia),
    messageId: txt(r.message_id),
    error: txt(r.error),
    enviadoEn: fecha(r.enviado_en),
    entregadoEn: fecha(r.entregado_en),
    abiertoEn: fecha(r.abierto_en),
    reboteEn: fecha(r.rebote_en),
    updatedAt: fecha(r.updated_at) ?? '',
    createdAt: fecha(r.created_at) ?? '',
  }
}

export function mapActividad(r: Fila): Actividad {
  return {
    id: Number(r.id),
    accion: String(r.accion ?? ''),
    descripcion: String(r.descripcion ?? ''),
    usuario: entero(r.usuario_id),
    email: txt(r.email),
    empresa: entero(r.empresa_id),
    origen: (r.origen as Actividad['origen']) ?? null,
    coleccion: txt(r.coleccion),
    registroId: txt(r.registro_id),
    ip: txt(r.ip),
    userAgent: txt(r.user_agent),
    datos: (jsonValor(r.datos) as Record<string, unknown> | null) ?? null,
    updatedAt: fecha(r.updated_at) ?? '',
    createdAt: fecha(r.created_at) ?? '',
  }
}

export function mapServicio(r: Fila, puntos: { texto: string; id?: string }[] = []): Servicio {
  return {
    id: Number(r.id),
    titulo: String(r.titulo ?? ''),
    slug: txt(r.slug),
    area: (r.area as Servicio['area']) ?? 'calidad',
    resumen: String(r.resumen ?? ''),
    enlace: txt(r.enlace),
    textoEnlace: txt(r.texto_enlace),
    destacado: bool(r.destacado),
    orden: num(r.orden) ?? 100,
    publicado: r.publicado == null ? true : bool(r.publicado),
    puntos,
  }
}

export function mapTrabajo(r: Fila): Trabajo {
  return {
    id: Number(r.id),
    titulo: String(r.titulo ?? ''),
    descripcion: txt(r.descripcion),
    cliente: txt(r.cliente),
    lugar: txt(r.lugar),
    anio: num(r.anio),
    area: (r.area as Trabajo['area']) ?? 'calidad',
    orden: num(r.orden) ?? 100,
    publicado: r.publicado == null ? true : bool(r.publicado),
  }
}
