import type { Area } from './web'

type ServicioInicial = { titulo: string; area: Area; resumen: string; puntos: string[]; destacado?: boolean; enlace?: string; textoEnlace?: string }
type TrabajoInicial = { titulo: string; descripcion?: string; cliente?: string; lugar?: string; area: Area }

/** Contenido de partida, tomado de la web actual de CMC (consultoracmc.es). Se edita después en Administración → Web. */
export const SERVICIOS_INICIALES: ServicioInicial[] = [
  {
    titulo: 'Sistemas de gestión de la calidad ISO 9001',
    area: 'calidad',
    resumen: 'Implantamos su sistema de gestión de la calidad según UNE-EN ISO 9001 y le acompañamos hasta la certificación.',
    puntos: ['Revisión inicial de la situación de la empresa', 'Diseño e implantación del sistema', 'Auditorías internas (auditor IRCA)', 'Preparación de la auditoría de certificación'],
    destacado: true,
  },
  {
    titulo: 'Excelencia en la gestión: modelo EFQM',
    area: 'calidad',
    resumen: 'Desarrollamos sistemas de gestión basados en el Modelo Europeo de Excelencia y realizamos evaluaciones como evaluador acreditado por el Club de Excelencia en Gestión.',
    puntos: ['Sistemas de gestión según el modelo EFQM', 'Autoevaluaciones y evaluaciones externas', 'Planes de mejora'],
  },
  {
    titulo: 'Certificación de producto y herramientas de gestión',
    area: 'calidad',
    resumen: 'Certificación de productos con la Marca N de AENOR e implantación de herramientas que mejoran el día a día de la producción.',
    puntos: ['Marca N de AENOR', 'Metodología 5S', 'Control de costes y de producción'],
  },
  {
    titulo: 'Sistemas de gestión medioambiental ISO 14001',
    area: 'medio-ambiente',
    resumen: 'Implantamos sistemas de gestión medioambiental según ISO 14001, solos o integrados con la calidad, adaptados a su actividad y a su tamaño.',
    puntos: ['Revisión medioambiental inicial', 'Implantación según ISO 14001', 'Sistemas integrados de calidad y medio ambiente', 'Auditorías internas medioambientales'],
    destacado: true,
  },
  {
    titulo: 'Estudios de impacto ambiental y vigilancia ambiental',
    area: 'medio-ambiente',
    resumen: 'Redactamos estudios de impacto ambiental y programas de vigilancia, y hacemos el seguimiento ambiental en obra y en explotación.',
    puntos: ['Estudios de impacto ambiental', 'Programas de vigilancia ambiental', 'Seguimiento en construcción: accesos, zanjas, residuos y vertidos', 'Seguimiento en explotación: revegetación, polvo, ruido y residuos'],
    destacado: true,
  },
  {
    titulo: 'Estudios y seguimientos de fauna y flora',
    area: 'medio-ambiente',
    resumen: 'Evaluamos la afección sobre la fauna y la flora de parques eólicos, líneas eléctricas, centrales fotovoltaicas y otras instalaciones.',
    puntos: ['Seguimiento de avifauna', 'Medidas antielectrocución y anticolisión en tendidos', 'Estudios específicos del medio natural'],
    destacado: true,
  },
  {
    titulo: 'Restauración de espacios degradados',
    area: 'medio-ambiente',
    resumen: 'Proyectos y asesoramiento para restaurar terrenos afectados por obras, canteras o instalaciones.',
    puntos: ['Estudios previos de restauración', 'Revegetación: siembras, hidrosiembras y plantaciones', 'Control del estado de la revegetación'],
  },
  {
    titulo: 'Sostenibilidad, licencias y asesoramiento ambiental',
    area: 'medio-ambiente',
    resumen: 'Elaboramos informes de sostenibilidad ambiental, tramitamos licencias ambientales y le asesoramos sobre la legislación aplicable.',
    puntos: ['Informes de sostenibilidad ambiental', 'Tramitación de licencias ambientales', 'Asesoramiento legislativo medioambiental'],
  },
  {
    titulo: 'Gestión documental y control de caducidades',
    area: 'gestion',
    resumen: 'Custodiamos su documentación regulatoria (certificados, inspecciones OCA, licencias) en un portal seguro y le avisamos antes de cada caducidad.',
    puntos: ['Portal documental con semáforo de caducidades', 'Avisos automáticos por correo', 'Renovaciones gestionadas por CMC si lo desea'],
    destacado: true,
    enlace: '/portal',
    textoEnlace: 'Acceder al portal',
  },
  {
    titulo: 'Permisos y expropiaciones en líneas eléctricas',
    area: 'gestion',
    resumen: 'Obtenemos los permisos de servidumbre de forma amistosa y, cuando es necesario, gestionamos las expropiaciones para el paso de líneas eléctricas.',
    puntos: ['Permisos amistosos de servidumbre', 'Expedientes de expropiación'],
  },
  {
    titulo: 'Tramitaciones, ayudas y subvenciones',
    area: 'gestion',
    resumen: 'Gestionamos sus tramitaciones ante los organismos públicos y la solicitud y justificación de ayudas y subvenciones.',
    puntos: ['Tramitaciones ante organismos públicos', 'Ayudas y subvenciones'],
    destacado: true,
  },
  {
    titulo: 'Formación en calidad y medio ambiente',
    area: 'gestion',
    resumen: 'Formación adaptada a su plantilla en sistemas de gestión, buenas prácticas ambientales y requisitos legales.',
    puntos: ['Formación en sistemas de gestión', 'Formación medioambiental'],
  },
]

const RIOJA = 'La Rioja'
const EN_OBRA = 'Control de zonas de acopio, caminos y accesos, zanjas y excavaciones, construcciones, residuos y vertidos, riesgos y accidentes.'
const EN_EXPLOTACION = 'Seguimiento de avifauna, revegetación, residuos, emisiones de polvo y ruido.'

export const TRABAJOS_INICIALES: TrabajoInicial[] = [
  { titulo: 'Seguimiento ambiental del parque eólico Cabimonteros (Sierra la Hez) durante su construcción', descripcion: EN_OBRA, cliente: 'DERrioja', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Permisos de servidumbre para el tendido de 66 kV de evacuación del parque eólico Cabimonteros', cliente: 'Iberinco', lugar: RIOJA, area: 'gestion' },
  { titulo: 'Seguimiento ambiental del tendido eléctrico de evacuación del parque eólico Cabimonteros durante su construcción', descripcion: `${EN_OBRA} Control de la colocación de medidas antielectrocución y anticolisión.`, cliente: 'DERrioja', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Seguimiento ambiental del parque eólico Cabimonteros en fase de explotación', descripcion: EN_EXPLOTACION, cliente: 'DERrioja', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Seguimiento ambiental del tendido eléctrico de Cabimonteros en fase de explotación', descripcion: 'Seguimiento de avifauna y de la revegetación.', cliente: 'DERrioja', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Estudios de impacto ambiental de los parques eólicos Gatún, Escurrillo y Yerga II', descripcion: 'Participación en los tres estudios.', cliente: 'Iberinco', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Permisos de servidumbre para la evacuación del parque eólico Yerga II', cliente: 'Iberinco', lugar: RIOJA, area: 'gestion' },
  { titulo: 'Asesoramiento sobre restauración de terrenos degradados por obras temporales', descripcion: 'Revegetación mediante siembras a mano, hidrosiembras y plantaciones.', cliente: 'DERrioja', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Estudio previo de restauración del parque eólico Alcarama II', cliente: 'Gamesa', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Seguimiento ambiental del parque eólico Escurrillo durante su construcción', descripcion: EN_OBRA, cliente: 'DERrioja', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Permisos de servidumbre para la línea eléctrica de 66 kV «Rincón II»', cliente: 'Iberdrola', lugar: RIOJA, area: 'gestion' },
  { titulo: 'Estudio de impacto ambiental del parque eólico Munilla – Lasanta', cliente: 'Molinos del Cidacos', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Seguimiento ambiental del parque eólico Escurrillo en fase de explotación', descripcion: EN_EXPLOTACION, cliente: 'DERrioja', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Permisos de servidumbre para la línea eléctrica de 13,2 kV «Pazuengos»', cliente: 'Iberdrola', lugar: RIOJA, area: 'gestion' },
  { titulo: 'Estudio de impacto ambiental del parque eólico Larriba – Hornillos', cliente: 'Molinos del Cidacos', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Estudio de impacto ambiental de la línea de 66 kV Santo Domingo – Urdanta', cliente: 'Eldu-Iberdrola', lugar: RIOJA, area: 'medio-ambiente' },
  { titulo: 'Seguimiento ambiental del parque eólico Igea-Cornago Sur en fase de explotación', descripcion: EN_EXPLOTACION, cliente: 'Molinos de La Rioja', lugar: RIOJA, area: 'medio-ambiente' },
]
