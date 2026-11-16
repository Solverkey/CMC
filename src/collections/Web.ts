import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { nadie, soloSuperAdmin } from '../access'
import { auditar } from '../lib/actividad'
import { normalizar } from '../lib/texto'
import { AREAS } from '../lib/web'

const publico = { read: () => true, create: soloSuperAdmin, update: soloSuperAdmin, delete: soloSuperAdmin }

const slugDesdeTitulo: CollectionBeforeChangeHook = ({ data }) => {
  if (data.titulo && !data.slug) data.slug = normalizar(data.titulo).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return data
}

const area = { name: 'area', label: 'Área', type: 'select', required: true, defaultValue: 'calidad', index: true, options: AREAS.map(({ value, label }) => ({ value, label })) } as const
const orden = { name: 'orden', type: 'number', defaultValue: 100, admin: { position: 'sidebar', description: 'Menor primero.' } } as const
const publicado = { name: 'publicado', type: 'checkbox', defaultValue: true, index: true, admin: { position: 'sidebar' } } as const

/** Servicios de la web pública, agrupados por área. */
export const Servicios: CollectionConfig = {
  slug: 'servicios',
  labels: { singular: 'Servicio', plural: 'Servicios' },
  admin: { group: 'Web', useAsTitle: 'titulo', defaultColumns: ['titulo', 'area', 'destacado', 'orden', 'publicado'] },
  defaultSort: 'orden',
  access: publico,
  hooks: { beforeChange: [slugDesdeTitulo], afterChange: [auditar('servicio', (d) => String(d.titulo), () => null)] },
  fields: [
    { name: 'titulo', label: 'Título', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true, admin: { position: 'sidebar', description: 'Ancla en la página de servicios. Se genera desde el título.' } },
    area,
    { name: 'resumen', type: 'textarea', required: true },
    { name: 'puntos', label: 'Qué incluye', type: 'array', fields: [{ name: 'texto', type: 'text', required: true }] },
    {
      type: 'row',
      fields: [
        { name: 'enlace', label: 'Enlace (opcional)', type: 'text', admin: { description: 'Ruta de la web (/portal) o dirección completa.' }, validate: (v: unknown) => !v || /^(\/|https:\/\/)/.test(String(v)) || 'Debe empezar por / o por https://' },
        { name: 'textoEnlace', label: 'Texto del enlace', type: 'text' },
      ],
    },
    { name: 'destacado', type: 'checkbox', defaultValue: false, admin: { position: 'sidebar', description: 'Se muestra en la página de inicio.' } },
    orden,
    publicado,
  ],
}

/** Trabajos realizados (referencias), con el cliente para la lista de «Han confiado en nosotros». */
export const Trabajos: CollectionConfig = {
  slug: 'trabajos',
  labels: { singular: 'Trabajo realizado', plural: 'Trabajos realizados' },
  admin: { group: 'Web', useAsTitle: 'titulo', defaultColumns: ['titulo', 'cliente', 'area', 'orden', 'publicado'] },
  defaultSort: 'orden',
  access: publico,
  hooks: { afterChange: [auditar('trabajo realizado', (d) => String(d.titulo), () => null)] },
  fields: [
    { name: 'titulo', label: 'Título', type: 'text', required: true },
    { name: 'descripcion', label: 'Descripción', type: 'textarea' },
    { type: 'row', fields: [{ name: 'cliente', type: 'text' }, { name: 'lugar', type: 'text' }, { name: 'anio', label: 'Año', type: 'number' }] },
    area,
    orden,
    publicado,
  ],
}

/** Consultas recibidas desde el formulario de contacto. Solo se crean desde la web, con validación y límite por IP. */
export const Consultas: CollectionConfig = {
  slug: 'consultas',
  labels: { singular: 'Consulta', plural: 'Consultas de la web' },
  admin: { group: 'Web', useAsTitle: 'nombre', defaultColumns: ['createdAt', 'nombre', 'empresa', 'email', 'estado'], listSearchableFields: ['nombre', 'empresa', 'email', 'mensaje'] },
  defaultSort: '-createdAt',
  access: { read: soloSuperAdmin, create: nadie, update: soloSuperAdmin, delete: soloSuperAdmin },
  // El alta queda registrada como «Consulta desde la web»; aquí solo los cambios de estado y notas.
  hooks: { afterChange: [(args) => (args.operation === 'update' ? auditar('consulta', (d) => `${d.nombre} <${d.email}>`, () => null)(args) : args.doc)] },
  fields: [
    { type: 'row', fields: [{ name: 'nombre', type: 'text', required: true, admin: { readOnly: true } }, { name: 'empresa', type: 'text', admin: { readOnly: true } }] },
    { type: 'row', fields: [{ name: 'email', type: 'email', required: true, admin: { readOnly: true } }, { name: 'telefono', label: 'Teléfono', type: 'text', admin: { readOnly: true } }] },
    { name: 'servicio', label: 'Servicio de interés', type: 'text', admin: { readOnly: true } },
    { name: 'mensaje', type: 'textarea', required: true, admin: { readOnly: true } },
    {
      name: 'estado',
      type: 'select',
      defaultValue: 'nueva',
      index: true,
      options: [
        { label: 'Nueva', value: 'nueva' },
        { label: 'Atendida', value: 'atendida' },
        { label: 'Descartada', value: 'descartada' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'notas', label: 'Notas internas', type: 'textarea', admin: { position: 'sidebar' } },
    { name: 'aceptaPrivacidad', label: 'Aceptó la política de privacidad', type: 'checkbox', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'ip', type: 'text', index: true, admin: { readOnly: true, position: 'sidebar' } },
  ],
}
