import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { APIError } from 'payload'
import { autenticado, isSuperAdmin, nadie, soloSuperAdmin } from '../access'
import { auditar } from '../lib/actividad'
import { EFECTOS, USOS, buscarEntrada, sugerir, type TipoCatalogo } from '../lib/catalogo'
import { normalizar } from '../lib/texto'

async function propagar(req: PayloadRequest, tipo: TipoCatalogo, de: string, a: string) {
  for (const { coleccion, campo } of USOS[tipo]) {
    await req.payload.update({
      collection: coleccion,
      where: { [campo]: { equals: de } },
      data: { [campo]: a },
      overrideAccess: true,
      req,
      context: { sinCatalogo: true, sinAvisos: true },
    })
  }
}

/**
 * Catálogos de nombres (RF-28): categorías, documentos y tipos de relación. CMC puede renombrar (se aplica a
 * todos los elementos que lo usan), fusionar duplicados y desactivar opciones.
 */
export const Catalogo: CollectionConfig = {
  slug: 'catalogo',
  labels: { singular: 'Nombre de catálogo', plural: 'Catálogos' },
  admin: { useAsTitle: 'nombre', defaultColumns: ['nombre', 'tipo', 'usos', 'activo'], group: 'Plataforma', listSearchableFields: ['nombre', 'normalizado'] },
  defaultSort: '-usos',
  access: { read: autenticado, create: soloSuperAdmin, update: soloSuperAdmin, delete: nadie },
  endpoints: [
    {
      path: '/sugerencias',
      method: 'get',
      handler: async (req) => {
        if (!req.user) return Response.json({ error: 'No autenticado' }, { status: 401 })
        const url = new URL(req.url ?? 'http://x')
        const tipo = url.searchParams.get('tipo') as TipoCatalogo
        if (!['categoria', 'documento', 'relacion'].includes(tipo)) return Response.json({ error: 'Tipo no válido' }, { status: 400 })
        return Response.json(await sugerir(req, tipo, url.searchParams.get('q') ?? '', url.searchParams.get('categoria')))
      },
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, originalDoc, operation, req }) => {
        if (data.nombre !== undefined) {
          data.nombre = String(data.nombre).trim()
          data.normalizado = normalizar(data.nombre)
        }
        const tipo = (data.tipo ?? originalDoc?.tipo) as TipoCatalogo
        if (data.nombre && (operation === 'create' || data.nombre !== originalDoc?.nombre)) {
          const ya = await buscarEntrada(req, tipo, data.nombre)
          if (ya && String(ya.id) !== String(originalDoc?.id)) throw new APIError(`Ya existe «${ya.nombre}» en este catálogo. Use «Fusionar en» para unificar.`, 400)
        }
        if (tipo === 'relacion' && operation === 'create' && !data.efectos?.length) throw new APIError('Indique el efecto del nuevo tipo de relación.', 400)
        if (data.fusionarEn && !originalDoc?.fusionarEn) data.activo = false
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation !== 'update' || req.context?.sinCatalogo) return doc
        const tipo = doc.tipo as TipoCatalogo
        const destinoId = typeof doc.fusionarEn === 'object' ? doc.fusionarEn?.id : doc.fusionarEn
        if (destinoId && !previousDoc?.fusionarEn) {
          const destino = await req.payload.findByID({ collection: 'catalogo', id: destinoId, depth: 0, overrideAccess: true, req })
          if (destino.tipo !== tipo) throw new APIError('Solo se puede fusionar con un nombre del mismo catálogo.', 400)
          await propagar(req, tipo, previousDoc.nombre, destino.nombre)
          await req.payload.update({ collection: 'catalogo', id: destino.id, data: { usos: (destino.usos ?? 0) + (doc.usos ?? 0) }, overrideAccess: true, req, context: { sinCatalogo: true } })
        } else if (previousDoc && doc.nombre !== previousDoc.nombre) {
          await propagar(req, tipo, previousDoc.nombre, doc.nombre)
        }
        return doc
      },
      auditar('nombre de catálogo', (d) => String(d.nombre), () => null),
    ],
  },
  fields: [
    {
      type: 'row',
      fields: [
        {
          name: 'tipo',
          type: 'select',
          required: true,
          index: true,
          options: [
            { label: 'Nombre de categoría', value: 'categoria' },
            { label: 'Nombre de documento', value: 'documento' },
            { label: 'Tipo de relación', value: 'relacion' },
          ],
        },
        { name: 'nombre', type: 'text', required: true },
      ],
    },
    {
      name: 'efectos',
      label: 'Efecto del tipo de relación',
      type: 'select',
      hasMany: true,
      options: [...EFECTOS],
      admin: { condition: (d) => d?.tipo === 'relacion', description: 'Se propone al asociar un archivo con este tipo; se puede corregir en cada asociación.' },
    },
    { name: 'usos', type: 'number', defaultValue: 0, admin: { position: 'sidebar', readOnly: true } },
    { name: 'activo', type: 'checkbox', defaultValue: true, admin: { position: 'sidebar', description: 'Desactivado: deja de sugerirse.' } },
    {
      name: 'fusionarEn',
      label: 'Fusionar en',
      type: 'relationship',
      relationTo: 'catalogo',
      admin: { position: 'sidebar', description: 'Todos los elementos que usan este nombre pasan a usar el elegido, y este se desactiva.' },
      filterOptions: ({ data, id }): Where => ({ and: [{ tipo: { equals: data?.tipo } }, { id: { not_equals: id } }, { activo: { equals: true } }] }),
      access: { update: ({ req }) => isSuperAdmin(req) },
    },
    { name: 'normalizado', type: 'text', index: true, admin: { hidden: true } },
  ],
}
