import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { nadie, porEmpresa, soloSuperAdmin } from '../access'
import { cambios, registrar } from '../lib/actividad'
import { usarNombre } from '../lib/catalogo'
import { leerConfiguracion } from '../lib/configuracion'
import { ESTADOS, calcularEstado, restarMeses, type Estado } from '../lib/estado'
import { campoCatalogo } from './Categorias'
import { gestionField } from './Empresas'

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string | null | undefined))
const dia = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : null)

export const Documentos: CollectionConfig = {
  slug: 'documentos',
  labels: { singular: 'Documento', plural: 'Documentos' },
  admin: {
    useAsTitle: 'titulo',
    defaultColumns: ['titulo', 'empresa', 'categoria', 'fechaCaducidad', 'estado'],
    group: 'Documentación',
    listSearchableFields: ['titulo', 'referencia', 'organismo'],
  },
  // Los usuarios de empresa consultan; solo CMC publica y edita (ellos envían a revisión vía «envios»).
  access: { read: porEmpresa(), create: soloSuperAdmin, update: soloSuperAdmin, delete: nadie },
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc, operation }) => {
        const has = (k: string) => Object.prototype.hasOwnProperty.call(data, k)
        const valor = (k: string) => (has(k) ? data[k] : originalDoc?.[k])

        const empresaId = idDe(valor('empresa'))
        const catId = idDe(valor('categoria'))
        const cat = catId ? await req.payload.findByID({ collection: 'categorias', id: catId, depth: 0, overrideAccess: true, req }) : null
        if (cat && String(idDe(cat.empresa)) !== String(empresaId)) throw new APIError('La categoría elegida pertenece a otra empresa.', 400, null, true)

        // Fecha de aviso: caducidad − antelación (categoría o plataforma), salvo que se fije una fecha concreta.
        const caducidad = valor('fechaCaducidad')
        const avisoCambiado = has('fechaAviso') && dia(data.fechaAviso) !== dia(originalDoc?.fechaAviso)
        const cambioCaducidad = operation === 'create' || dia(caducidad) !== dia(originalDoc?.fechaCaducidad)
        if (!caducidad) {
          data.fechaAviso = null
          data.avisoManual = false
        } else if (avisoCambiado && data.fechaAviso) {
          data.avisoManual = true
        } else if (cambioCaducidad || !valor('fechaAviso')) {
          const meses = typeof cat?.antelacionMeses === 'number' ? cat.antelacionMeses : (await leerConfiguracion(req.payload, req)).antelacionMeses
          data.fechaAviso = restarMeses(new Date(caducidad), meses).toISOString()
          data.avisoManual = false
        }

        data.estado = calcularEstado({ fechaCaducidad: caducidad, fechaAviso: valor('fechaAviso'), estadoManual: valor('estadoManual') })
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'create' || doc.titulo !== previousDoc?.titulo) await usarNombre(req, 'documento', doc.titulo)
        const empresa = idDe(doc.empresa)
        if (operation === 'create') {
          await registrar(req, { accion: 'alta', descripcion: `Alta del documento «${doc.titulo}»`, empresa, coleccion: 'documentos', registroId: doc.id })
          return doc
        }
        if (previousDoc.estado !== doc.estado) {
          const manual = doc.estadoManual !== previousDoc.estadoManual
          await registrar(req, {
            accion: 'cambio_estado',
            descripcion: `«${doc.titulo}»: ${ESTADOS[previousDoc.estado as Estado]?.label ?? '—'} → ${ESTADOS[doc.estado as Estado].label}${manual ? ' (manual)' : ' (automático)'}`,
            empresa,
            coleccion: 'documentos',
            registroId: doc.id,
            datos: { antes: previousDoc.estado, despues: doc.estado, manual, motivo: manual ? doc.motivoEstado ?? null : 'Cálculo por fechas' },
          })
        }
        const diff = cambios(previousDoc, doc)
        delete diff.estado
        if (Object.keys(diff).length) {
          await registrar(req, {
            accion: 'edicion',
            descripcion: diff.categoria ? `Documento «${doc.titulo}» movido de categoría` : `Edición del documento «${doc.titulo}»`,
            empresa,
            coleccion: 'documentos',
            registroId: doc.id,
            datos: { cambios: diff },
          })
        }
        return doc
      },
    ],
  },
  fields: [
    { name: 'titulo', label: 'Título', type: 'text', required: true, admin: { components: campoCatalogo('documento', 'categoria') } },
    {
      type: 'row',
      fields: [
        { name: 'empresa', type: 'relationship', relationTo: 'empresas', required: true, index: true },
        {
          name: 'categoria',
          label: 'Categoría',
          type: 'relationship',
          relationTo: 'categorias',
          required: true,
          index: true,
          filterOptions: ({ data }) => (data?.empresa ? { empresa: { equals: idDe(data.empresa) } } : true),
        },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'referencia', type: 'text' },
        { name: 'organismo', label: 'Organismo emisor', type: 'text' },
      ],
    },
    {
      type: 'row',
      fields: [
        { name: 'fechaEmision', label: 'Fecha de emisión', type: 'date', admin: { date: { displayFormat: 'dd/MM/yyyy' } } },
        {
          name: 'fechaCaducidad',
          label: 'Fecha de caducidad',
          type: 'date',
          index: true,
          admin: { date: { displayFormat: 'dd/MM/yyyy' }, description: 'Vacío = indefinido (no genera avisos).' },
        },
        { name: 'fechaAviso', label: 'Fecha de aviso', type: 'date', index: true, admin: { date: { displayFormat: 'dd/MM/yyyy' }, description: 'Se propone sola; puede fijar otra.' } },
      ],
    },
    { name: 'avisoManual', type: 'checkbox', label: 'Fecha de aviso fijada a mano', defaultValue: false, admin: { readOnly: true } },
    {
      name: 'estado',
      type: 'select',
      index: true,
      admin: { readOnly: true, position: 'sidebar', description: 'Se recalcula al guardar y cada noche.' },
      options: [
        { label: 'Verde · Vigente', value: 'verde' },
        { label: 'Amarillo · Caducidad próxima', value: 'amarillo' },
        { label: 'Naranja · Condicionada', value: 'naranja' },
        { label: 'Rojo · Caducada', value: 'rojo' },
        { label: 'Azul · Pasado o archivado', value: 'azul' },
        { label: 'Negro · No legalizado', value: 'negro' },
      ],
    },
    {
      name: 'estadoManual',
      label: 'Estado manual',
      type: 'select',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Naranja · Condicionada', value: 'naranja' },
        { label: 'Rojo · Revocada o no válida', value: 'rojo' },
        { label: 'Azul · Pasado o archivado', value: 'azul' },
        { label: 'Negro · No legalizado', value: 'negro' },
      ],
    },
    {
      name: 'motivoEstado',
      label: 'Motivo del estado manual',
      type: 'textarea',
      admin: { position: 'sidebar', condition: (data) => Boolean(data?.estadoManual) },
      validate: (val: unknown, { siblingData }: { siblingData: { estadoManual?: string } }) => (siblingData?.estadoManual && !val ? 'Indique el motivo.' : true),
    },
    { name: 'limiteSubsanacion', label: 'Fecha límite de subsanación', type: 'date', admin: { position: 'sidebar', condition: (d) => d?.estadoManual === 'naranja' } },
    { ...gestionField, admin: { ...gestionField.admin, position: 'sidebar' } },
    { name: 'tecnico', label: 'Técnico de CMC responsable', type: 'relationship', relationTo: 'users', filterOptions: { rol: { equals: 'superadmin' } }, admin: { position: 'sidebar', description: 'Vacío: el responsable de la categoría o de la empresa.' } },
    { name: 'archivoVigente', type: 'relationship', relationTo: 'archivos', admin: { readOnly: true } },
    {
      name: 'historico',
      type: 'join',
      collection: 'archivos',
      on: 'documento',
      defaultSort: '-createdAt',
      admin: { description: 'Todos los archivos asociados. Nunca se borra ninguno. Use «Añadir» para subir una renovación, subsanación o anexo.' },
    },
    { name: 'observaciones', type: 'textarea' },
    { name: 'etiquetas', type: 'text', hasMany: true },
  ],
}
