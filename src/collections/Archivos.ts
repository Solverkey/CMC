import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { isSuperAdmin, nadie, porEmpresa, soloSuperAdmin } from '../access'
import { registrar } from '../lib/actividad'
import { EFECTOS, efectosDe, usarNombre } from '../lib/catalogo'
import { urlServidor } from '../lib/configuracion'
import { programarCorreo } from '../lib/correo'
import { usuariosEmpresa } from '../lib/destinatarios'
import { dirSubidas } from '../lib/ficheros'
import { MIME_DOCUMENTOS, cabecerasVisor, comprimirImagenes, ficheroInmutable, guardarOriginal, registrarDescarga, tamano } from '../lib/subidas'
import { campoCatalogo } from './Categorias'

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string))

export const Archivos: CollectionConfig = {
  slug: 'archivos',
  labels: { singular: 'Archivo asociado', plural: 'Archivos asociados' },
  admin: { useAsTitle: 'filename', defaultColumns: ['filename', 'documento', 'relacion', 'historico', 'createdAt'], group: 'Documentación' },
  access: { read: porEmpresa(), create: soloSuperAdmin, update: soloSuperAdmin, delete: nadie },
  upload: {
    staticDir: dirSubidas('archivos'),
    mimeTypes: MIME_DOCUMENTOS,
    handlers: [registrarDescarga],
    modifyResponseHeaders: cabecerasVisor,
    hideRemoveFile: true,
  },
  hooks: {
    beforeOperation: [ficheroInmutable, comprimirImagenes],
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        const docId = idDe(data.documento ?? originalDoc?.documento)
        const doc = await req.payload.findByID({ collection: 'documentos', id: docId, depth: 0, overrideAccess: true, req })
        // La empresa se hereda siempre del documento: es la que decide quién puede ver el archivo.
        data.empresa = idDe(doc.empresa)
        if (operation !== 'create') return data
        if (req.user) data.subidoPor = req.user.id
        data.relacion = String(data.relacion ?? 'Original').trim()
        if (!data.efectos?.length) {
          const propuestos = await efectosDe(req, data.relacion)
          if (!propuestos) throw new APIError(`«${data.relacion}» es un tipo de relación nuevo: indique su efecto.`, 400, null, true)
          data.efectos = propuestos
        }
        if (data.efectos.includes('actualiza_fechas') && !data.nuevaCaducidad) throw new APIError('Este tipo de relación actualiza fechas: indique la nueva caducidad.', 400, null, true)
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation !== 'create') return doc
        const docId = idDe(doc.documento)
        const efectos: string[] = doc.efectos ?? []
        const update: Record<string, unknown> = {}
        if (efectos.includes('sustituye')) {
          update.archivoVigente = doc.id
          // Los anteriores quedan en el histórico, visibles solo dentro del documento.
          await req.payload.update({
            collection: 'archivos',
            where: { and: [{ documento: { equals: docId } }, { id: { not_equals: doc.id } }, { historico: { equals: false } }] },
            data: { historico: true },
            overrideAccess: true,
            req,
          })
        }
        const actual = await req.payload.findByID({ collection: 'documentos', id: docId, depth: 0, overrideAccess: true, req })
        if (efectos.includes('actualiza_fechas') && doc.nuevaCaducidad) {
          update.fechaCaducidad = doc.nuevaCaducidad
          if (doc.nuevoAviso) update.fechaAviso = doc.nuevoAviso
          update.estadoManual = null
          update.motivoEstado = null
        }
        if (efectos.includes('levanta') && actual.estadoManual === 'naranja') {
          update.estadoManual = null
          update.motivoEstado = null
        }
        if (Object.keys(update).length) await req.payload.update({ collection: 'documentos', id: docId, data: update, overrideAccess: true, req })

        await usarNombre(req, 'relacion', doc.relacion, { efectos })
        await registrar(req, {
          accion: 'subida',
          descripcion: `${doc.relacion} «${doc.filename}» en «${actual.titulo}» (${tamano(doc.filesize)}${doc.tamanoOriginal ? `, original ${tamano(doc.tamanoOriginal)}` : ''})`,
          empresa: doc.empresa,
          coleccion: 'archivos',
          registroId: doc.id,
        })
        if (!req.context?.sinAvisos) {
          const empresa = await req.payload.findByID({ collection: 'empresas', id: idDe(doc.empresa), depth: 0, overrideAccess: true, req })
          await programarCorreo(req, {
            plantilla: 'renovacion_disponible',
            para: await usuariosEmpresa(req, empresa.id),
            vars: { documento: actual.titulo, empresa: empresa.razonSocial, tipo: doc.relacion.toLowerCase() },
            enlace: `${urlServidor()}/portal/documentos/${docId}`,
            empresa: empresa.id,
            documento: docId,
          })
        }
        return doc
      },
      guardarOriginal,
    ],
  },
  fields: [
    { name: 'documento', type: 'relationship', relationTo: 'documentos', required: true, index: true },
    { name: 'empresa', type: 'relationship', relationTo: 'empresas', index: true, admin: { readOnly: true, description: 'Se toma del documento. Se usa para el control de acceso.' } },
    {
      name: 'relacion',
      label: 'Tipo de relación',
      type: 'text',
      required: true,
      defaultValue: 'Original',
      admin: { description: 'Renovación, Actualización, Subsanación, Anexo… o uno nuevo.', components: campoCatalogo('relacion') },
    },
    { name: 'efectos', type: 'select', hasMany: true, options: [...EFECTOS], admin: { description: 'Vacío = el efecto del tipo de relación. Puede corregirlo antes de guardar.' } },
    {
      type: 'row',
      fields: [
        { name: 'nuevaCaducidad', label: 'Nueva caducidad', type: 'date', admin: { date: { displayFormat: 'dd/MM/yyyy' } } },
        { name: 'nuevoAviso', label: 'Nuevo aviso', type: 'date', admin: { date: { displayFormat: 'dd/MM/yyyy' }, description: 'Vacío = se calcula.' } },
      ],
    },
    { name: 'comentario', type: 'textarea' },
    { name: 'historico', type: 'checkbox', defaultValue: false, index: true, admin: { readOnly: true, description: 'Sustituido: queda en el histórico del documento.' } },
    { name: 'tamanoOriginal', label: 'Tamaño original (bytes)', type: 'number', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'subidoPor', type: 'relationship', relationTo: 'users', admin: { readOnly: true }, access: { update: ({ req }) => isSuperAdmin(req) } },
  ],
}
