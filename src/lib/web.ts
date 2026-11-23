import type { Media, Servicio, Trabajo } from '@/datos/tipos'
import { bool, filas, uno } from '@/lib/db'
import { urlDe } from '@/lib/ficheros'

export const AREAS = [
  { value: 'calidad', label: 'Calidad', titulo: 'Calidad y excelencia', texto: 'Sistemas de gestión que ordenan su organización y le preparan para la certificación.' },
  { value: 'medio-ambiente', label: 'Medio ambiente', titulo: 'Medio ambiente', texto: 'Integración ambiental de proyectos, desde el estudio de impacto hasta el seguimiento en explotación.' },
  { value: 'gestion', label: 'Gestión y tramitación', titulo: 'Gestión y tramitación', texto: 'Permisos, licencias, ayudas y documentación al día ante las administraciones.' },
] as const

export type Area = (typeof AREAS)[number]['value']

export const areaDe = (v?: string | null) => AREAS.find((a) => a.value === v) ?? AREAS[0]

export type Sede = { ciudad: string; direccion: string; codigoPostal: string; telefono: string }

export type DatosWeb = {
  portada: { antetitulo: string; titulo: string; subtitulo: string; imagen?: Media; videos: string[] }
  presentacion: string
  profesionales: { titulo: string; texto: string }[]
  sedes: Sede[]
  email: string
  descripcion: string
  legal: { titular: string; cif?: string; domicilio: string; registro?: string }
  textosLegales: { avisoLegal?: string; privacidad?: string; cookies?: string }
  emailsConsultas: string[]
}

export const WEB_POR_DEFECTO: DatosWeb = {
  portada: {
    antetitulo: 'Logroño · Burgos · Desde 2000',
    titulo: 'Calidad y medio ambiente, con rigor técnico',
    subtitulo: 'Implantamos sistemas ISO 9001 e ISO 14001, realizamos estudios de impacto ambiental y de fauna y flora, y mantenemos al día la documentación regulatoria de su empresa.',
    videos: [],
  },
  presentacion:
    'CMC centra su actividad en dos áreas: la calidad y el medio ambiente.\n\nComenzamos en el año 2000 con la implantación de sistemas de gestión de la calidad según la norma ISO 9001 y de sistemas de gestión medioambiental según la norma ISO 14001. Desde entonces hemos incorporado estudios de impacto ambiental, seguimientos ambientales y la evaluación de la afección sobre la flora y la fauna de parques eólicos, líneas eléctricas y centrales fotovoltaicas, entre otras instalaciones.\n\nTambién elaboramos informes de sostenibilidad ambiental, tramitamos licencias ambientales, impartimos formación y gestionamos ayudas y subvenciones: cubrimos las necesidades reales de nuestros clientes.',
  profesionales: [
    { titulo: 'Biología', texto: 'Licenciados en Biología con amplia experiencia en la integración ambiental de parques eólicos, líneas eléctricas, concentraciones parcelarias, canteras y depuradoras, y en estudios específicos del medio natural.' },
    { titulo: 'Ingeniería y calidad', texto: 'Ingeniero técnico industrial con máster en Ingeniería y Tecnología del Medio Ambiente, formación en gestión de la calidad (AEC, AENOR), evaluador acreditado del modelo EFQM y auditor IRCA.' },
    { titulo: 'Administración y colaboradores', texto: 'Personal administrativo y colaboradores externos que nos permiten ofrecer un servicio completo en calidad y medio ambiente.' },
  ],
  sedes: [
    { ciudad: 'Logroño', direccion: 'C/ General Vara de Rey, 48', codigoPostal: '26002 Logroño', telefono: '941 28 71 08' },
    { ciudad: 'Burgos', direccion: 'C/ Vitoria, 17', codigoPostal: '09004 Burgos', telefono: '669 47 94 49' },
  ],
  email: 'info@consultoracmc.es',
  descripcion: 'Consultoría de calidad y medio ambiente en Logroño y Burgos: implantación ISO 9001 e ISO 14001, estudios de impacto ambiental, fauna y flora, licencias y gestión documental.',
  legal: { titular: 'CMC · Consultoría de calidad y medio ambiente', domicilio: 'C/ General Vara de Rey, 48, 26002 Logroño (La Rioja)' },
  textosLegales: {},
  emailsConsultas: [],
}

const texto = (v: unknown, d: string) => (typeof v === 'string' && v.trim() ? v : d)

/** Contenido editable de la web, con los valores por defecto para lo que no se haya guardado. */
export async function leerWeb(): Promise<DatosWeb> {
  try {
    return await leerWebGuardada()
  } catch (error) {
    console.error('La web pública no ha podido leer la base de datos.', error instanceof Error ? error.message : error)
    return WEB_POR_DEFECTO
  }
}

async function leerWebGuardada(): Promise<DatosWeb> {
  const g = await uno<Record<string, unknown>>('SELECT * FROM web ORDER BY id LIMIT 1')
  const d = WEB_POR_DEFECTO
  if (!g) return d
  const id = Number(g.id)
  const [profesionales, sedes, emails, videos] = await Promise.all([
    filas<{ titulo: string; texto: string }>('SELECT titulo, texto FROM web_profesionales WHERE _parent_id = $1 ORDER BY _order', [id]),
    filas<{ ciudad: string; telefono: string; direccion: string; codigo_postal: string }>('SELECT ciudad, telefono, direccion, codigo_postal FROM web_sedes WHERE _parent_id = $1 ORDER BY _order', [id]),
    filas<{ email: string }>('SELECT email FROM web_emails_consultas WHERE _parent_id = $1 ORDER BY _order', [id]),
    filas<{ url: string | null; filename: string | null }>('SELECT v.url, v.filename FROM web_rels r JOIN videos v ON v.id = r.videos_id WHERE r.parent_id = $1 AND r.path = $2 ORDER BY r."order"', [id, 'portada.videos']),
  ])
  let imagen: Media | undefined
  if (g.portada_imagen_id) {
    const media = await uno<Record<string, unknown>>('SELECT * FROM media WHERE id = $1', [Number(g.portada_imagen_id)])
    if (media?.filename) {
      imagen = {
        id: Number(media.id),
        alt: String(media.alt ?? ''),
        url: await urlDe('media', String(media.filename)),
        filename: String(media.filename),
        updatedAt: String(media.updated_at ?? ''),
        createdAt: String(media.created_at ?? ''),
      }
    }
  }
  return {
    portada: {
      antetitulo: texto(g.portada_antetitulo, d.portada.antetitulo),
      titulo: texto(g.portada_titulo, d.portada.titulo),
      subtitulo: texto(g.portada_subtitulo, d.portada.subtitulo),
      imagen,
      videos: (await Promise.all(videos.map(async (v) => (v.filename ? urlDe('videos', v.filename) : v.url ?? '')))).filter(Boolean),
    },
    presentacion: texto(g.presentacion, d.presentacion),
    profesionales: profesionales.length ? profesionales : d.profesionales,
    sedes: sedes.length ? sedes.map((s) => ({ ciudad: s.ciudad, direccion: s.direccion, codigoPostal: s.codigo_postal, telefono: s.telefono })) : d.sedes,
    email: texto(g.email, d.email),
    descripcion: texto(g.descripcion, d.descripcion),
    legal: { titular: texto(g.legal_titular, d.legal.titular), cif: (g.legal_cif as string) || undefined, domicilio: texto(g.legal_domicilio, d.legal.domicilio), registro: (g.legal_registro as string) || undefined },
    textosLegales: { avisoLegal: (g.aviso_legal as string) || undefined, privacidad: (g.privacidad as string) || undefined, cookies: (g.cookies as string) || undefined },
    emailsConsultas: emails.map((e) => e.email).filter(Boolean),
  }
}

export async function serviciosPublicados() {
  try {
    return await serviciosGuardados()
  } catch (error) {
    console.error('La web pública no ha podido leer los servicios.', error instanceof Error ? error.message : error)
    return []
  }
}

async function serviciosGuardados() {
  const rows = await filas<Record<string, unknown>>('SELECT * FROM servicios WHERE publicado IS NULL OR publicado IS NOT FALSE ORDER BY orden LIMIT 200')
  const puntos = rows.length
    ? await filas<{ parent: number; texto: string; id: string }>('SELECT _parent_id AS parent, texto, id FROM servicios_puntos ORDER BY _order')
    : []
  return rows.map((r) => ({
    id: Number(r.id),
    titulo: String(r.titulo),
    slug: (r.slug as string) ?? null,
    area: (r.area as Servicio['area']) ?? 'calidad',
    resumen: String(r.resumen ?? ''),
    enlace: (r.enlace as string) ?? null,
    textoEnlace: (r.texto_enlace as string) ?? null,
    destacado: bool(r.destacado),
    orden: r.orden == null ? null : Number(r.orden),
    publicado: bool(r.publicado),
    puntos: puntos.filter((p) => p.parent === Number(r.id)).map((p) => ({ texto: p.texto, id: p.id })),
  })) satisfies Servicio[]
}

export async function trabajosPublicados(limite = 200) {
  try {
    return await trabajosGuardados(limite)
  } catch (error) {
    console.error('La web pública no ha podido leer los trabajos.', error instanceof Error ? error.message : error)
    return []
  }
}

async function trabajosGuardados(limite: number) {
  const rows = await filas<Record<string, unknown>>('SELECT * FROM trabajos WHERE publicado IS NULL OR publicado IS NOT FALSE ORDER BY orden LIMIT $1', [limite])
  return rows.map((r) => ({
    id: Number(r.id),
    titulo: String(r.titulo),
    descripcion: (r.descripcion as string) ?? null,
    cliente: (r.cliente as string) ?? null,
    lugar: (r.lugar as string) ?? null,
    anio: r.anio == null ? null : Number(r.anio),
    area: (r.area as Trabajo['area']) ?? 'calidad',
    orden: r.orden == null ? null : Number(r.orden),
    publicado: bool(r.publicado),
  }))
}

/** Clientes únicos a partir de los trabajos, en orden de aparición. */
export const clientesDe = (trabajos: Trabajo[]) => [...new Set(trabajos.map((t) => t.cliente?.trim()).filter((c): c is string => Boolean(c)))]

export const telefonoHref = (t: string) => `tel:+34${t.replace(/\D/g, '')}`
