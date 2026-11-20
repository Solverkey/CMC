import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import type { Empresa, User } from '@/payload-types'
import { isSuperAdmin, nadie, porEmpresa, puedeVerEmpresa, soloSuperAdmin } from '../access'
import { registrar } from '../lib/actividad'
import { urlServidor } from '../lib/configuracion'
import { programarCorreo } from '../lib/correo'
import { destinatariosCMC, tecnicoResponsable } from '../lib/destinatarios'
import { dirSubidas, leerFichero } from '../lib/ficheros'
import { MIME_DOCUMENTOS, cabecerasVisor, comprimirImagenes, ficheroInmutable, guardarOriginal, registrarDescarga } from '../lib/subidas'
import { campoCatalogo } from './Categorias'

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string | null | undefined))

/** Bandeja de entrada de CMC (RF-25): los usuarios de empresa envían, CMC revisa, completa y publica o rechaza. */
export const Envios: CollectionConfig = {
  slug: 'envios',
  labels: { singular: 'Envío a revisión', plural: 'Bandeja de revisión' },
  admin: { useAsTitle: 'titulo', defaultColumns: ['titulo', 'empresa', 'estado', 'enviadoPor', 'createdAt'], group: 'Documentación' },
  defaultSort: '-createdAt',
  access: {
    read: porEmpresa(),
    create: ({ req }) => Boolean(req.user && req.user.collection === 'users'),
    update: soloSuperAdmin,
    delete: nadie,
  },
  upload: {
    staticDir: dirSubidas('envios'),
    mimeTypes: MIME_DOCUMENTOS,
    handlers: [registrarDescarga],
    modifyResponseHeaders: cabecerasVisor,
    hideRemoveFile: true,
  },
  hooks: {
    beforeOperation: [ficheroInmutable, comprimirImagenes],
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        const empresa = idDe(data.empresa ?? originalDoc?.empresa)
        if (operation === 'create') {
          if (!req.user) throw new APIError('No autenticado.', 401)
          if (!puedeVerEmpresa(req.user, empresa!)) throw new APIError('No tiene acceso a esa empresa.', 403, null, true)
          data.enviadoPor = req.user.id
          if (!isSuperAdmin(req)) {
            data.estado = 'pendiente'
            for (const k of ['documentoDestino', 'categoriaDestino', 'tituloFinal', 'fechaEmision', 'fechaCaducidad', 'fechaAviso', 'relacionFinal', 'motivoRechazo']) delete data[k]
          }
          if (data.documentoRelacionado) {
            const rel = await req.payload.findByID({ collection: 'documentos', id: idDe(data.documentoRelacionado)!, depth: 0, user: req.user, overrideAccess: false, req }).catch(() => null)
            if (!rel || String(idDe(rel.empresa)) !== String(empresa)) throw new APIError('El documento indicado no pertenece a esa empresa.', 400, null, true)
          }
          return data
        }
        if (originalDoc.estado !== 'pendiente' && data.estado && data.estado !== originalDoc.estado) throw new APIError('Este envío ya está resuelto.', 400, null, true)
        if (data.estado === 'publicado' && originalDoc.estado === 'pendiente') {
          const destino = idDe(data.documentoDestino)
          if (destino) {
            const d = await req.payload.findByID({ collection: 'documentos', id: destino, depth: 0, overrideAccess: true, req })
            if (String(idDe(d.empresa)) !== String(empresa)) throw new APIError('El documento de destino es de otra empresa.', 400, null, true)
          } else {
            const cat = idDe(data.categoriaDestino)
            if (!cat) throw new APIError('Elija el documento donde publicar o la categoría del documento nuevo.', 400, null, true)
            const c = await req.payload.findByID({ collection: 'categorias', id: cat, depth: 0, overrideAccess: true, req })
            if (String(idDe(c.empresa)) !== String(empresa)) throw new APIError('La categoría es de otra empresa.', 400, null, true)
          }
          data.resueltoPor = req.user?.id
          data.resueltoEn = new Date().toISOString()
        }
        if (data.estado === 'rechazado' && originalDoc.estado === 'pendiente') {
          if (!data.motivoRechazo) throw new APIError('Indique el motivo del rechazo.', 400, null, true)
          data.resueltoPor = req.user?.id
          data.resueltoEn = new Date().toISOString()
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        const empresa = (await req.payload.findByID({ collection: 'empresas', id: idDe(doc.empresa)!, depth: 0, overrideAccess: true, req })) as Empresa
        if (operation === 'create') {
          await registrar(req, { accion: 'envio', descripcion: `Envío a revisión «${doc.titulo}» (${doc.filename})`, empresa: empresa.id, coleccion: 'envios', registroId: doc.id })
          if (!isSuperAdmin(req)) {
            const tecnico = await tecnicoResponsable(req, { tecnico: null }, null, empresa)
            await programarCorreo(req, {
              plantilla: 'envio_recibido',
              para: [...(tecnico ? [{ email: tecnico.email, usuario: tecnico.id, tipo: 'cmc' as const }] : []), ...(await destinatariosCMC(req))],
              vars: { empresa: empresa.razonSocial, documento: doc.titulo, nombre: (req.user as unknown as User)?.nombre },
              enlace: `${urlServidor()}/portal/enviar/${doc.id}`,
              empresa: empresa.id,
            })
          }
          return doc
        }
        if (previousDoc?.estado !== 'pendiente' || doc.estado === 'pendiente') return doc

        const autor = (await req.payload.findByID({ collection: 'users', id: idDe(doc.enviadoPor)!, depth: 0, overrideAccess: true, req }).catch(() => null)) as User | null
        if (doc.estado === 'rechazado') {
          await registrar(req, { accion: 'rechazo', descripcion: `Rechazado el envío «${doc.titulo}»: ${doc.motivoRechazo}`, empresa: empresa.id, coleccion: 'envios', registroId: doc.id })
          if (autor)
            await programarCorreo(req, {
              plantilla: 'envio_rechazado',
              para: [{ email: autor.email, usuario: autor.id, tipo: 'cliente' }],
              vars: { documento: doc.titulo, motivo: doc.motivoRechazo, empresa: empresa.razonSocial },
              enlace: `${urlServidor()}/portal/documentos?empresa=${empresa.id}`,
              empresa: empresa.id,
            })
          return doc
        }

        // Publicación: en un documento existente o en uno nuevo con la categoría y fechas que completa CMC.
        let destino = idDe(doc.documentoDestino)
        const titulo = doc.tituloFinal?.trim() || doc.titulo
        if (!destino) {
          const nuevo = await req.payload.create({
            collection: 'documentos',
            overrideAccess: true,
            req,
            data: { titulo, empresa: empresa.id, categoria: idDe(doc.categoriaDestino) as number, fechaEmision: doc.fechaEmision, fechaCaducidad: doc.fechaCaducidad, fechaAviso: doc.fechaAviso },
          })
          destino = nuevo.id
          await req.payload.update({ collection: 'envios', id: doc.id, data: { documentoDestino: nuevo.id as number }, overrideAccess: true, req, context: { sinAvisos: true } })
        }
        const relacion = doc.relacionFinal?.trim() || (doc.documentoDestino ? doc.relacion || 'Renovación' : 'Original')
        const caducidad = doc.documentoDestino ? doc.fechaCaducidad || doc.nuevaCaducidad : undefined
        const data = await leerFichero(req.payload, 'envios', doc)
        await req.payload.create({
          collection: 'archivos',
          overrideAccess: true,
          req,
          context: { sinComprimir: true },
          data: { documento: destino as number, relacion, nuevaCaducidad: caducidad, nuevoAviso: doc.documentoDestino ? doc.fechaAviso : undefined, comentario: `Publicado desde el envío «${doc.titulo}»${doc.comentario ? `: ${doc.comentario}` : ''}` },
          file: { data, mimetype: doc.mimeType ?? 'application/octet-stream', name: doc.filename!, size: data.length },
        })
        const final = doc.documentoDestino ? ((await req.payload.findByID({ collection: 'documentos', id: destino!, depth: 0, overrideAccess: true, req }).catch(() => null))?.titulo ?? titulo) : titulo
        await registrar(req, { accion: 'publicacion', descripcion: `Publicado el envío «${doc.titulo}» en «${final}»`, empresa: empresa.id, coleccion: 'envios', registroId: doc.id })
        if (autor)
          await programarCorreo(req, {
            plantilla: 'envio_publicado',
            para: [{ email: autor.email, usuario: autor.id, tipo: 'cliente' }],
            vars: { documento: doc.titulo, empresa: empresa.razonSocial },
            enlace: `${urlServidor()}/portal/documentos/${destino}`,
            empresa: empresa.id,
            documento: destino,
          })
        return doc
      },
      guardarOriginal,
    ],
  },
  fields: [
    { name: 'titulo', label: 'Nombre propuesto', type: 'text', required: true, admin: { components: campoCatalogo('documento') } },
    { name: 'empresa', type: 'relationship', relationTo: 'empresas', required: true, index: true },
    { name: 'documentoRelacionado', label: 'Documento al que se refiere', type: 'relationship', relationTo: 'documentos', filterOptions: ({ data }) => (data?.empresa ? { empresa: { equals: idDe(data.empresa) } } : true) },
    { name: 'relacion', label: 'Tipo de relación propuesto', type: 'text', defaultValue: 'Renovación' },
    { name: 'nuevaCaducidad', label: 'Nueva caducidad propuesta', type: 'date', admin: { date: { displayFormat: 'dd/MM/yyyy' } } },
    { name: 'comentario', type: 'textarea' },
    {
      name: 'estado',
      type: 'select',
      defaultValue: 'pendiente',
      index: true,
      options: [
        { label: 'Pendiente', value: 'pendiente' },
        { label: 'Publicado', value: 'publicado' },
        { label: 'Rechazado', value: 'rechazado' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      type: 'collapsible',
      label: 'Publicación (CMC)',
      admin: { condition: (d) => d?.estado !== 'rechazado', description: 'Elija un documento existente o, para uno nuevo, la categoría y las fechas.' },
      fields: [
        { name: 'documentoDestino', label: 'Publicar en el documento', type: 'relationship', relationTo: 'documentos', filterOptions: ({ data }) => (data?.empresa ? { empresa: { equals: idDe(data.empresa) } } : true) },
        { name: 'relacionFinal', label: 'Tipo de relación', type: 'text', admin: { components: campoCatalogo('relacion'), description: 'Vacío = el propuesto (o «Original» en un documento nuevo).' } },
        { name: 'categoriaDestino', label: 'Categoría (documento nuevo)', type: 'relationship', relationTo: 'categorias', filterOptions: ({ data }) => (data?.empresa ? { empresa: { equals: idDe(data.empresa) } } : true), admin: { condition: (d) => !d?.documentoDestino } },
        { name: 'tituloFinal', label: 'Nombre definitivo', type: 'text', admin: { components: campoCatalogo('documento', 'categoriaDestino') } },
        {
          type: 'row',
          fields: [
            { name: 'fechaEmision', label: 'Emisión', type: 'date', admin: { date: { displayFormat: 'dd/MM/yyyy' } } },
            { name: 'fechaCaducidad', label: 'Caducidad', type: 'date', admin: { date: { displayFormat: 'dd/MM/yyyy' } } },
            { name: 'fechaAviso', label: 'Aviso', type: 'date', admin: { date: { displayFormat: 'dd/MM/yyyy' }, description: 'Vacío = se calcula.' } },
          ],
        },
      ],
    },
    {
      name: 'motivoRechazo',
      type: 'textarea',
      admin: { position: 'sidebar', condition: (d) => d?.estado === 'rechazado' },
      validate: (v: unknown, { siblingData }: { siblingData: { estado?: string } }) => (siblingData?.estado === 'rechazado' && !v ? 'Indique el motivo.' : true),
    },
    { name: 'tamanoOriginal', label: 'Tamaño original (bytes)', type: 'number', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'enviadoPor', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'resueltoPor', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'resueltoEn', type: 'date', admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
  ],
}
