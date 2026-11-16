import path from 'path'
import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { empresasDe, isSuperAdmin, porEmpresa, soloSuperAdmin } from '../access'

/** Bandeja de entrada de CMC (RF-25): los usuarios de empresa envían, CMC revisa y publica o rechaza. */
export const Envios: CollectionConfig = {
  slug: 'envios',
  labels: { singular: 'Envío a revisión', plural: 'Bandeja de revisión' },
  admin: { useAsTitle: 'titulo', defaultColumns: ['titulo', 'empresa', 'estado', 'createdAt'], group: 'Documentación' },
  access: {
    read: porEmpresa(),
    create: ({ req }) => Boolean(req.user),
    update: soloSuperAdmin,
    delete: () => false,
  },
  upload: {
    staticDir: 'uploads/envios',
    mimeTypes: ['application/pdf', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.*', 'application/vnd.ms-excel'],
    resizeOptions: { width: 2500, height: 2500, fit: 'inside', withoutEnlargement: true },
    formatOptions: { format: 'webp', options: { quality: 82 } },
  },
  hooks: {
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation !== 'create' || !req.user) return data
        data.enviadoPor = req.user.id
        if (!isSuperAdmin(req)) {
          const empresa = String(typeof data.empresa === 'object' ? data.empresa?.id : data.empresa)
          if (!empresasDe(req.user).map(String).includes(empresa)) throw new APIError('No tiene acceso a esa empresa.', 403)
          data.estado = 'pendiente'
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, collection }) => {
        // Al publicar, CMC elige el documento destino y se crea el archivo asociado con el mismo fichero.
        if (doc.estado !== 'publicado' || previousDoc?.estado === 'publicado' || !doc.documentoDestino) return doc
        const docId = typeof doc.documentoDestino === 'object' ? doc.documentoDestino.id : doc.documentoDestino
        const empresa = typeof doc.empresa === 'object' ? doc.empresa.id : doc.empresa
        const staticDir = (collection.upload as { staticDir: string }).staticDir
        await req.payload.create({
          collection: 'archivos',
          data: {
            documento: docId,
            empresa,
            relacion: doc.relacion || 'Renovación',
            nuevaCaducidad: doc.nuevaCaducidad,
            comentario: `Publicado desde el envío «${doc.titulo}»`,
          },
          filePath: path.resolve(process.cwd(), staticDir, doc.filename),
          req,
        })
        return doc
      },
    ],
  },
  fields: [
    { name: 'titulo', label: 'Nombre propuesto', type: 'text', required: true },
    { name: 'empresa', type: 'relationship', relationTo: 'empresas', required: true, index: true },
    { name: 'documentoRelacionado', label: 'Documento al que se refiere', type: 'relationship', relationTo: 'documentos' },
    { name: 'relacion', label: 'Tipo de relación', type: 'text', defaultValue: 'Renovación' },
    { name: 'nuevaCaducidad', label: 'Nueva caducidad propuesta', type: 'date' },
    { name: 'comentario', type: 'textarea' },
    {
      name: 'estado',
      type: 'select',
      defaultValue: 'pendiente',
      options: [
        { label: 'Pendiente', value: 'pendiente' },
        { label: 'Publicado', value: 'publicado' },
        { label: 'Rechazado', value: 'rechazado' },
      ],
      admin: { position: 'sidebar' },
    },
    { name: 'documentoDestino', label: 'Publicar en el documento', type: 'relationship', relationTo: 'documentos', admin: { position: 'sidebar', condition: (d) => d?.estado !== 'rechazado' } },
    {
      name: 'motivoRechazo',
      type: 'textarea',
      admin: { position: 'sidebar', condition: (d) => d?.estado === 'rechazado' },
      validate: (v: unknown, { siblingData }: { siblingData: { estado?: string } }) => (siblingData?.estado === 'rechazado' && !v ? 'Indique el motivo.' : true),
    },
    { name: 'enviadoPor', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}
