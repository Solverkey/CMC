import type { GlobalConfig } from 'payload'
import { isSuperAdmin } from '../access'
import { registrar } from '../lib/actividad'
import { WEB_POR_DEFECTO as d } from '../lib/web'

const ayudaLegal = 'Déjelo vacío para usar el texto por defecto, que se rellena con los datos del titular. Separe los párrafos con una línea en blanco; una línea que empiece por «## » es un apartado.'

/** Contenido editable de la web pública. Lo que se deje vacío usa los textos por defecto. */
export const Web: GlobalConfig = {
  slug: 'web',
  label: 'Web',
  admin: { group: 'Web' },
  access: { read: () => true, update: ({ req }) => isSuperAdmin(req) },
  hooks: {
    afterChange: [
      async ({ req }) => {
        await registrar(req, { accion: 'edicion', descripcion: 'Edición del contenido de la web', coleccion: 'web' })
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Portada',
          fields: [
            {
              name: 'portada',
              type: 'group',
              label: false,
              fields: [
                { name: 'antetitulo', label: 'Antetítulo', type: 'text', admin: { placeholder: d.portada.antetitulo } },
                { name: 'titulo', label: 'Título', type: 'text', admin: { placeholder: d.portada.titulo } },
                { name: 'subtitulo', label: 'Subtítulo', type: 'textarea', admin: { placeholder: d.portada.subtitulo } },
                { name: 'imagen', type: 'upload', relationTo: 'media', admin: { description: 'Opcional. Fotografía de cabecera (horizontal). Se usa si no hay vídeos.' } },
                {
                  name: 'videos',
                  label: 'Vídeos',
                  type: 'upload',
                  relationTo: 'videos',
                  hasMany: true,
                  admin: { description: 'Mp4 o WebM, unos 15 segundos. Si hay más de uno, la portada enseña 5 segundos de cada clip y pasa al siguiente.' },
                },
              ],
            },
            { name: 'descripcion', label: 'Descripción para buscadores', type: 'textarea', maxLength: 300, admin: { placeholder: d.descripcion } },
          ],
        },
        {
          label: 'Quiénes somos',
          fields: [
            { name: 'presentacion', label: 'Presentación', type: 'textarea', admin: { placeholder: d.presentacion, rows: 10 } },
            {
              name: 'profesionales',
              label: 'Equipo',
              type: 'array',
              admin: { description: 'Vacío: se muestra el equipo por defecto.' },
              fields: [
                { name: 'titulo', label: 'Título', type: 'text', required: true },
                { name: 'texto', type: 'textarea', required: true },
              ],
            },
          ],
        },
        {
          label: 'Contacto',
          fields: [
            { name: 'email', label: 'Correo de contacto', type: 'email', admin: { placeholder: d.email } },
            {
              name: 'sedes',
              type: 'array',
              admin: { description: 'Vacío: Logroño y Burgos.' },
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'ciudad', type: 'text', required: true },
                    { name: 'telefono', label: 'Teléfono', type: 'text', required: true },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    { name: 'direccion', label: 'Dirección', type: 'text', required: true },
                    { name: 'codigoPostal', label: 'Código postal y localidad', type: 'text', required: true },
                  ],
                },
              ],
            },
            {
              name: 'emailsConsultas',
              label: 'Quién recibe las consultas de la web',
              type: 'array',
              access: { read: ({ req }) => isSuperAdmin(req) },
              admin: { description: 'Vacío: los super administradores que reciben avisos.' },
              fields: [{ name: 'email', type: 'email', required: true }],
            },
          ],
        },
        {
          label: 'Textos legales',
          fields: [
            {
              name: 'legal',
              type: 'group',
              label: 'Titular de la web',
              fields: [
                { type: 'row', fields: [{ name: 'titular', label: 'Razón social', type: 'text', admin: { placeholder: d.legal.titular } }, { name: 'cif', label: 'CIF', type: 'text' }] },
                { name: 'domicilio', type: 'text', admin: { placeholder: d.legal.domicilio } },
                { name: 'registro', label: 'Datos registrales', type: 'text', admin: { description: 'Si es una sociedad: Registro Mercantil, tomo, folio y hoja.' } },
              ],
            },
            { name: 'avisoLegal', label: 'Aviso legal', type: 'textarea', admin: { description: ayudaLegal, rows: 10 } },
            { name: 'privacidad', label: 'Política de privacidad', type: 'textarea', admin: { description: ayudaLegal, rows: 10 } },
            { name: 'cookies', label: 'Política de cookies', type: 'textarea', admin: { description: ayudaLegal, rows: 10 } },
          ],
        },
      ],
    },
  ],
}
