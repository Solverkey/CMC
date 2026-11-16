import type { Field, GlobalConfig } from 'payload'
import { isSuperAdmin } from '../access'
import { registrar } from '../lib/actividad'
import { PLANTILLAS } from '../lib/plantillas'

const camposPlantillas: Field[] = Object.entries(PLANTILLAS).map(([clave, p]) => ({
  type: 'collapsible',
  label: p.etiqueta,
  admin: { initCollapsed: true },
  fields: [
    {
      name: clave,
      type: 'group',
      label: false,
      fields: [
        { name: 'asunto', type: 'text', defaultValue: p.asunto },
        { name: 'cuerpo', type: 'textarea', defaultValue: p.cuerpo },
        { name: 'boton', label: 'Texto del botón', type: 'text', defaultValue: p.boton },
      ],
    },
  ],
}))

export const Configuracion: GlobalConfig = {
  slug: 'configuracion',
  label: 'Configuración',
  admin: { group: 'Plataforma' },
  access: { read: ({ req }) => isSuperAdmin(req), update: ({ req }) => isSuperAdmin(req) },
  hooks: {
    afterChange: [
      async ({ req }) => {
        await registrar(req, { accion: 'edicion', descripcion: 'Cambio en la configuración de la plataforma', coleccion: 'configuracion' })
      },
    ],
  },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Avisos',
          fields: [
            { name: 'antelacionMeses', label: 'Antelación de aviso por defecto (meses)', type: 'number', min: 0, defaultValue: 2, admin: { description: 'La categoría y el documento pueden cambiarla; manda el nivel más concreto.' } },
            { name: 'recordatorioDiasAntes', label: 'Recordatorio antes de la caducidad (días)', type: 'number', min: 0, defaultValue: 15 },
            {
              name: 'frecuenciaCaducado',
              label: 'Recordatorio mientras siga caducado',
              type: 'select',
              defaultValue: 'semanal',
              options: [
                { label: 'Semanal', value: 'semanal' },
                { label: 'Mensual', value: 'mensual' },
              ],
            },
            { name: 'maxRecordatoriosCaducado', label: 'Máximo de recordatorios tras caducar', type: 'number', min: 0, defaultValue: 6, admin: { description: 'En documentos gestionados, el cliente solo recibe el aviso inicial, el de caducidad y la renovación disponible; el resto va al técnico de CMC.' } },
          ],
        },
        {
          label: 'Correo',
          fields: [
            {
              type: 'row',
              fields: [
                { name: 'remitenteNombre', label: 'Nombre del remitente', type: 'text', defaultValue: 'CMC · Portal documental' },
                { name: 'remitenteEmail', label: 'Dirección del remitente', type: 'email', admin: { description: 'Del dominio de CMC (p. ej. avisos@dominio-de-cmc). Vacío = EMAIL_FROM.' } },
                { name: 'responderA', label: 'Dirección de respuesta', type: 'email' },
              ],
            },
            { name: 'logo', label: 'Logotipo de CMC para los correos', type: 'upload', relationTo: 'media' },
            { name: 'colorPrimario', label: 'Color principal', type: 'text', defaultValue: '#4d6162' },
            { name: 'firma', type: 'textarea', defaultValue: 'CMC · Consultoría de calidad y medio ambiente' },
            { name: 'plantillas', type: 'group', label: 'Plantillas', fields: camposPlantillas },
          ],
        },
        {
          label: 'Imágenes',
          description: 'Compresión automática de las imágenes que se suben (los PDF y los Office no se alteran).',
          fields: [
            { name: 'ladoMaximo', label: 'Tamaño máximo del lado mayor (px)', type: 'number', min: 500, defaultValue: 2500 },
            { name: 'calidad', label: 'Calidad (1-100)', type: 'number', min: 40, max: 100, defaultValue: 82 },
            { name: 'conservarOriginal', label: 'Conservar también la imagen original', type: 'checkbox', defaultValue: false },
          ],
        },
        {
          label: 'Almacenamiento',
          fields: [
            { name: 'limiteGB', label: 'Almacenamiento incluido (GB)', type: 'number', min: 1, defaultValue: 10 },
            { name: 'avisoPorcentaje', label: 'Avisar al alcanzar (%)', type: 'number', min: 1, max: 100, defaultValue: 80 },
          ],
        },
        {
          label: 'Plantilla de categorías',
          description: 'Categorías estándar de CMC que se crean al dar de alta una empresa (se pueden adaptar después).',
          fields: [
            {
              name: 'plantillaCategorias',
              label: 'Categorías',
              type: 'array',
              defaultValue: [{ nombre: 'Certificados ISO' }, { nombre: 'Inspecciones OCA' }, { nombre: 'Licencias' }, { nombre: 'Proyectos' }],
              fields: [
                {
                  type: 'row',
                  fields: [
                    { name: 'nombre', type: 'text', required: true },
                    { name: 'antelacionMeses', label: 'Antelación (meses)', type: 'number', min: 0 },
                    {
                      name: 'gestion',
                      label: 'Modalidad',
                      type: 'select',
                      options: [
                        { label: 'Gestionado por CMC', value: 'gestionado' },
                        { label: 'No gestionado', value: 'no_gestionado' },
                      ],
                    },
                  ],
                },
                { name: 'descripcion', label: 'Descripción', type: 'textarea' },
              ],
            },
          ],
        },
      ],
    },
  ],
}
