export interface Media {
  id: number
  alt: string
  updatedAt: string
  createdAt: string
  url?: string | null
  thumbnailURL?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
}

export interface Empresa {
  id: number
  razonSocial: string
  cif: string
  direccion?: string | null
  sector?: string | null
  logo?: number | Media | null
  contacto?: string | null
  emailsAviso?: { email: string; id?: string | null }[] | null
  gestion?: 'gestionado' | 'no_gestionado' | null
  antelacionMeses?: number | null
  tecnico?: number | User | null
  activa?: boolean | null
  adminEmail?: string | null
  adminNombre?: string | null
  aplicarPlantilla?: boolean | null
  updatedAt: string
  createdAt: string
}

export interface User {
  id: number
  nombre: string
  rol: 'superadmin' | 'cliente'
  empresas?: { empresa: number | Empresa; rol: 'admin' | 'usuario'; id?: string | null }[] | null
  recibeAvisos?: boolean | null
  activo?: boolean | null
  totpActivo?: boolean | null
  totpSecreto?: string | null
  totpPendiente?: string | null
  totpUltimoPaso?: number | null
  invitacionHash?: string | null
  updatedAt: string
  createdAt: string
  email: string
  resetPasswordToken?: string | null
  resetPasswordExpiration?: string | null
  salt?: string | null
  hash?: string | null
  resetPasswordRequestedAt?: string | null
  loginAttempts?: number | null
  lockUntil?: string | null
  password?: string | null
  collection: 'users'
}

export interface Categoria {
  id: number
  nombre: string
  empresa: number | Empresa
  descripcion?: string | null
  antelacionMeses?: number | null
  gestion?: 'gestionado' | 'no_gestionado' | null
  responsable?: number | User | null
  orden?: number | null
  archivada?: boolean | null
  updatedAt: string
  createdAt: string
}

export interface Archivo {
  id: number
  documento: number | Documento
  empresa?: number | Empresa | null
  relacion: string
  efectos?: ('sustituye' | 'actualiza_fechas' | 'levanta' | 'complementario')[] | null
  nuevaCaducidad?: string | null
  nuevoAviso?: string | null
  comentario?: string | null
  historico?: boolean | null
  tamanoOriginal?: number | null
  subidoPor?: number | User | null
  updatedAt: string
  createdAt: string
  url?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
  width?: number | null
  height?: number | null
}

export interface Documento {
  id: number
  titulo: string
  empresa: number | Empresa
  categoria: number | Categoria
  referencia?: string | null
  organismo?: string | null
  fechaEmision?: string | null
  fechaCaducidad?: string | null
  fechaAviso?: string | null
  avisoManual?: boolean | null
  estado?: 'verde' | 'amarillo' | 'naranja' | 'rojo' | 'azul' | 'negro' | null
  estadoManual?: 'naranja' | 'rojo' | 'azul' | 'negro' | null
  motivoEstado?: string | null
  limiteSubsanacion?: string | null
  gestion?: 'gestionado' | 'no_gestionado' | null
  tecnico?: number | User | null
  archivoVigente?: number | Archivo | null
  observaciones?: string | null
  etiquetas?: string[] | null
  updatedAt: string
  createdAt: string
}

export interface Envio {
  id: number
  titulo: string
  empresa: number | Empresa
  documentoRelacionado?: number | Documento | null
  relacion?: string | null
  nuevaCaducidad?: string | null
  comentario?: string | null
  estado?: 'pendiente' | 'publicado' | 'rechazado' | null
  documentoDestino?: number | Documento | null
  relacionFinal?: string | null
  categoriaDestino?: number | Categoria | null
  tituloFinal?: string | null
  fechaEmision?: string | null
  fechaCaducidad?: string | null
  fechaAviso?: string | null
  motivoRechazo?: string | null
  tamanoOriginal?: number | null
  enviadoPor?: number | User | null
  resueltoPor?: number | User | null
  resueltoEn?: string | null
  updatedAt: string
  createdAt: string
  url?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
}

export interface Hilo {
  id: number
  asunto: string
  empresa: number | Empresa
  categoria?: number | Categoria | null
  documento?: number | Documento | null
  estado?: 'abierto' | 'resuelto' | null
  asignado?: number | User | null
  creadoPor?: number | User | null
  ultimoMensaje?: string | null
  updatedAt: string
  createdAt: string
}

export interface Adjunto {
  id: number
  empresa: number | Empresa
  subidoPor?: number | User | null
  tamanoOriginal?: number | null
  updatedAt: string
  createdAt: string
  url?: string | null
  filename?: string | null
  mimeType?: string | null
  filesize?: number | null
}

export interface Mensaje {
  id: number
  hilo: number | Hilo
  texto: string
  adjuntos?: (number | Adjunto)[] | null
  empresa?: number | Empresa | null
  autor?: number | User | null
  updatedAt: string
  createdAt: string
}

export interface Catalogo {
  id: number
  tipo: 'categoria' | 'documento' | 'relacion'
  nombre: string
  efectos?: ('sustituye' | 'actualiza_fechas' | 'levanta' | 'complementario')[] | null
  usos?: number | null
  activo?: boolean | null
  fusionarEn?: number | Catalogo | null
  normalizado?: string | null
  updatedAt: string
  createdAt: string
}

export interface Correo {
  id: number
  asunto: string
  para: string
  usuario?: number | User | null
  destinatario?: 'cliente' | 'cmc' | null
  estado?: 'pendiente' | 'enviado' | 'entregado' | 'abierto' | 'rebotado' | 'error' | null
  plantilla?: string | null
  texto?: string | null
  empresa?: number | Empresa | null
  documento?: number | Documento | null
  hilo?: number | Hilo | null
  idempotencia?: string | null
  messageId?: string | null
  error?: string | null
  enviadoEn?: string | null
  entregadoEn?: string | null
  abiertoEn?: string | null
  reboteEn?: string | null
  updatedAt: string
  createdAt: string
}

export interface Actividad {
  id: number
  accion: string
  descripcion: string
  usuario?: number | User | null
  email?: string | null
  empresa?: number | Empresa | null
  origen?: 'web' | 'mcp' | 'sistema' | null
  coleccion?: string | null
  registroId?: string | null
  ip?: string | null
  userAgent?: string | null
  datos?: Record<string, unknown> | null
  updatedAt: string
  createdAt: string
}

export interface Servicio {
  id: number
  titulo: string
  slug?: string | null
  area: 'calidad' | 'medio-ambiente' | 'gestion'
  resumen: string
  enlace?: string | null
  textoEnlace?: string | null
  destacado?: boolean | null
  orden?: number | null
  publicado?: boolean | null
  puntos?: { texto: string; id?: string | null }[] | null
}

export interface Trabajo {
  id: number
  titulo: string
  descripcion?: string | null
  cliente?: string | null
  lugar?: string | null
  anio?: number | null
  area: 'calidad' | 'medio-ambiente' | 'gestion'
  orden?: number | null
  publicado?: boolean | null
}
