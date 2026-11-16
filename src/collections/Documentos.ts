import type { CollectionConfig } from 'payload'
import { porEmpresa, soloSuperAdmin } from '../access'
import { ANTELACION_MESES_DEFECTO, calcularEstado, restarMeses } from '../lib/estado'
import { gestionField } from './Empresas'

export const Documentos: CollectionConfig = {
  slug: 'documentos',
  labels: { singular: 'Documento', plural: 'Documentos' },
  admin: {
    useAsTitle: 'titulo',
    defaultColumns: ['titulo', 'empresa', 'categoria', 'fechaCaducidad', 'estado'],
    group: 'Documentación',
  },
  // Los usuarios de empresa consultan; solo CMC publica y edita (envían a revisión vía «envios»).
  access: { read: porEmpresa(), create: soloSuperAdmin, update: soloSuperAdmin, delete: () => false },
  hooks: {
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        const caducidad = data.fechaCaducidad ?? originalDoc?.fechaCaducidad
        const cambioCaducidad = data.fechaCaducidad && data.fechaCaducidad !== originalDoc?.fechaCaducidad
        // Fecha de aviso propuesta: caducidad − antelación de la categoría (o 2 meses), salvo que se indique a mano.
        if (caducidad && (!data.fechaAviso || (cambioCaducidad && !data.avisoManual))) {
          let meses = ANTELACION_MESES_DEFECTO
          const catId = typeof data.categoria === 'object' ? data.categoria?.id : data.categoria
          if (catId) {
            const cat = await req.payload.findByID({ collection: 'categorias', id: catId, depth: 0, req })
            if (typeof cat?.antelacionMeses === 'number') meses = cat.antelacionMeses
          }
          data.fechaAviso = restarMeses(new Date(caducidad), meses).toISOString()
        }
        data.estado = calcularEstado({
          fechaCaducidad: caducidad,
          fechaAviso: data.fechaAviso ?? originalDoc?.fechaAviso,
          estadoManual: data.estadoManual ?? originalDoc?.estadoManual,
        })
        return data
      },
    ],
  },
  fields: [
    { name: 'titulo', label: 'Título', type: 'text', required: true },
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
          filterOptions: ({ data }) => (data?.empresa ? { empresa: { equals: data.empresa } } : true),
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
        { name: 'fechaAviso', label: 'Fecha de aviso', type: 'date', index: true, admin: { date: { displayFormat: 'dd/MM/yyyy' } } },
      ],
    },
    { name: 'avisoManual', type: 'checkbox', label: 'Fecha de aviso fijada a mano', defaultValue: false },
    {
      name: 'estado',
      type: 'select',
      index: true,
      admin: { readOnly: true, position: 'sidebar', description: 'Se recalcula al guardar y cada noche.' },
      options: [
        { label: 'Verde · Vigente', value: 'verde' },
        { label: 'Amarillo · Condicionada', value: 'amarillo' },
        { label: 'Naranja · Caducidad próxima', value: 'naranja' },
        { label: 'Rojo · Caducada', value: 'rojo' },
        { label: 'Negro · No aplica', value: 'negro' },
      ],
    },
    {
      name: 'estadoManual',
      label: 'Estado manual',
      type: 'select',
      admin: { position: 'sidebar' },
      options: [
        { label: 'Amarillo · Condicionada', value: 'amarillo' },
        { label: 'Rojo · Revocada', value: 'rojo' },
        { label: 'Negro · No aplica', value: 'negro' },
      ],
    },
    {
      name: 'motivoEstado',
      label: 'Motivo del estado manual',
      type: 'textarea',
      admin: { position: 'sidebar', condition: (data) => Boolean(data?.estadoManual) },
      validate: (val: unknown, { siblingData }: { siblingData: { estadoManual?: string } }) =>
        siblingData?.estadoManual && !val ? 'Indique el motivo.' : true,
    },
    { name: 'limiteSubsanacion', label: 'Fecha límite de subsanación', type: 'date', admin: { position: 'sidebar', condition: (d) => d?.estadoManual === 'amarillo' } },
    { ...gestionField, admin: { ...gestionField.admin, position: 'sidebar' } },
    { name: 'archivoVigente', type: 'relationship', relationTo: 'archivos', admin: { readOnly: true } },
    {
      name: 'historico',
      type: 'join',
      collection: 'archivos',
      on: 'documento',
      defaultSort: '-createdAt',
      admin: { description: 'Todos los archivos asociados. Nunca se borra ninguno.' },
    },
    { name: 'observaciones', type: 'textarea' },
    { name: 'etiquetas', type: 'text', hasMany: true },
  ],
}
