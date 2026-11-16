import type { Payload } from 'payload'
import type { Media, Servicio, Trabajo } from '@/payload-types'

export const AREAS = [
  { value: 'calidad', label: 'Calidad', titulo: 'Calidad y excelencia', texto: 'Sistemas de gestión que ordenan su organización y le preparan para la certificación.' },
  { value: 'medio-ambiente', label: 'Medio ambiente', titulo: 'Medio ambiente', texto: 'Integración ambiental de proyectos, desde el estudio de impacto hasta el seguimiento en explotación.' },
  { value: 'gestion', label: 'Gestión y tramitación', titulo: 'Gestión y tramitación', texto: 'Permisos, licencias, ayudas y documentación al día ante las administraciones.' },
] as const

export type Area = (typeof AREAS)[number]['value']

export const areaDe = (v?: string | null) => AREAS.find((a) => a.value === v) ?? AREAS[0]

export type Sede = { ciudad: string; direccion: string; codigoPostal: string; telefono: string }

export type DatosWeb = {
  portada: { antetitulo: string; titulo: string; subtitulo: string; imagen?: Media }
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

/** Contenido editable de la web (Administración → Web) con los valores por defecto para lo que no se haya guardado. */
export async function leerWeb(payload: Payload): Promise<DatosWeb> {
  const g = (await payload.findGlobal({ slug: 'web', depth: 1, overrideAccess: true }).catch(() => ({}))) as Record<string, any>
  const d = WEB_POR_DEFECTO
  const p = g.portada ?? {}
  const l = g.legal ?? {}
  return {
    portada: {
      antetitulo: texto(p.antetitulo, d.portada.antetitulo),
      titulo: texto(p.titulo, d.portada.titulo),
      subtitulo: texto(p.subtitulo, d.portada.subtitulo),
      imagen: p.imagen && typeof p.imagen === 'object' && p.imagen.url ? (p.imagen as Media) : undefined,
    },
    presentacion: texto(g.presentacion, d.presentacion),
    profesionales: g.profesionales?.length ? g.profesionales : d.profesionales,
    sedes: g.sedes?.length ? g.sedes : d.sedes,
    email: texto(g.email, d.email),
    descripcion: texto(g.descripcion, d.descripcion),
    legal: { titular: texto(l.titular, d.legal.titular), cif: l.cif || undefined, domicilio: texto(l.domicilio, d.legal.domicilio), registro: l.registro || undefined },
    textosLegales: { avisoLegal: g.avisoLegal || undefined, privacidad: g.privacidad || undefined, cookies: g.cookies || undefined },
    emailsConsultas: (g.emailsConsultas ?? []).map((e: { email: string }) => e.email).filter(Boolean),
  }
}

export async function serviciosPublicados(payload: Payload) {
  const { docs } = await payload.find({ collection: 'servicios', where: { publicado: { equals: true } }, sort: 'orden', limit: 200, depth: 0, overrideAccess: true })
  return docs as Servicio[]
}

export async function trabajosPublicados(payload: Payload, limite = 200) {
  const { docs } = await payload.find({ collection: 'trabajos', where: { publicado: { equals: true } }, sort: 'orden', limit: limite, depth: 0, overrideAccess: true })
  return docs as Trabajo[]
}

/** Clientes únicos a partir de los trabajos, en orden de aparición. */
export const clientesDe = (trabajos: Trabajo[]) => [...new Set(trabajos.map((t) => t.cliente?.trim()).filter((c): c is string => Boolean(c)))]

export const telefonoHref = (t: string) => `tel:+34${t.replace(/\D/g, '')}`
