import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import type { Hilo, User } from '@/payload-types'
import { esSuperAdmin, isSuperAdmin, nadie, porEmpresa, puedeVerEmpresa, soloSuperAdmin } from '../access'
import { cambios, registrar } from '../lib/actividad'
import { urlServidor } from '../lib/configuracion'
import { programarCorreo } from '../lib/correo'
import { destinatariosCMC } from '../lib/destinatarios'
import { dirSubidas } from '../lib/ficheros'
import { MIME_DOCUMENTOS, comprimirImagenes, guardarOriginal, registrarDescarga } from '../lib/subidas'

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number | string }).id : (v as number | string | null | undefined))

const crearConAcceso = ({ req }: { req: { user?: unknown } }) => Boolean(req.user && (req.user as { collection?: string }).collection === 'users')

/** Conversaciones por empresa (RF-26): generales o vinculadas a una categoría o a un documento. */
export const Hilos: CollectionConfig = {
  slug: 'hilos',
  labels: { singular: 'Conversación', plural: 'Comunicación' },
  admin: { useAsTitle: 'asunto', defaultColumns: ['asunto', 'empresa', 'estado', 'asignado', 'ultimoMensaje'], group: 'Clientes' },
  defaultSort: '-ultimoMensaje',
  access: { read: porEmpresa(), create: crearConAcceso, update: soloSuperAdmin, delete: nadie },
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        const empresa = idDe(data.empresa ?? originalDoc?.empresa)!
        if (operation === 'create') {
          if (!puedeVerEmpresa(req.user, empresa)) throw new APIError('No tiene acceso a esa empresa.', 403, null, true)
          data.creadoPor = req.user?.id
          data.ultimoMensaje = new Date().toISOString()
          if (!isSuperAdmin(req)) {
            data.estado = 'abierto'
            delete data.asignado
          }
        }
        for (const [campo, coleccion] of [['documento', 'documentos'], ['categoria', 'categorias']] as const) {
          const id = idDe(data[campo])
          if (!id) continue
          const r = await req.payload.findByID({ collection: coleccion, id, depth: 0, overrideAccess: true, req })
          if (String(idDe(r.empresa)) !== String(empresa)) throw new APIError('El elemento vinculado es de otra empresa.', 400, null, true)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        if (operation === 'create') {
          await registrar(req, { accion: 'mensaje', descripcion: `Nueva conversación «${doc.asunto}»`, empresa: idDe(doc.empresa), coleccion: 'hilos', registroId: doc.id })
          return doc
        }
        const diff = cambios(previousDoc, doc)
        delete diff.ultimoMensaje
        if (Object.keys(diff).length) await registrar(req, { accion: 'edicion', descripcion: `Conversación «${doc.asunto}»: ${diff.estado ? `estado ${doc.estado}` : 'reasignada'}`, empresa: idDe(doc.empresa), coleccion: 'hilos', registroId: doc.id, datos: { cambios: diff } })
        return doc
      },
    ],
  },
  fields: [
    { name: 'asunto', type: 'text', required: true },
    {
      type: 'row',
      fields: [
        { name: 'empresa', type: 'relationship', relationTo: 'empresas', required: true, index: true },
        { name: 'categoria', label: 'Categoría', type: 'relationship', relationTo: 'categorias', filterOptions: ({ data }) => (data?.empresa ? { empresa: { equals: idDe(data.empresa) } } : true) },
        { name: 'documento', type: 'relationship', relationTo: 'documentos', index: true, filterOptions: ({ data }) => (data?.empresa ? { empresa: { equals: idDe(data.empresa) } } : true) },
      ],
    },
    {
      name: 'estado',
      type: 'select',
      defaultValue: 'abierto',
      index: true,
      admin: { position: 'sidebar' },
      options: [
        { label: 'Abierto', value: 'abierto' },
        { label: 'Resuelto', value: 'resuelto' },
      ],
    },
    { name: 'asignado', label: 'Persona de CMC asignada', type: 'relationship', relationTo: 'users', index: true, filterOptions: { rol: { equals: 'superadmin' } }, admin: { position: 'sidebar' } },
    { name: 'creadoPor', type: 'relationship', relationTo: 'users', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'ultimoMensaje', type: 'date', index: true, admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'mensajes', type: 'join', collection: 'mensajes', on: 'hilo', defaultSort: 'createdAt' },
  ],
}

/** Mensajes: registro permanente, no se pueden editar ni borrar una vez enviados. */
export const Mensajes: CollectionConfig = {
  slug: 'mensajes',
  labels: { singular: 'Mensaje', plural: 'Mensajes' },
  admin: { useAsTitle: 'texto', defaultColumns: ['texto', 'hilo', 'autor', 'createdAt'], group: 'Clientes' },
  defaultSort: 'createdAt',
  access: { read: porEmpresa(), create: crearConAcceso, update: nadie, delete: nadie },
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        if (operation !== 'create') return data
        const hilo = (await req.payload.findByID({ collection: 'hilos', id: idDe(data.hilo)!, depth: 0, overrideAccess: true, req })) as Hilo
        if (!puedeVerEmpresa(req.user, idDe(hilo.empresa)!)) throw new APIError('No tiene acceso a esta conversación.', 403, null, true)
        if (!String(data.texto ?? '').trim()) throw new APIError('El mensaje está vacío.', 400, null, true)
        data.empresa = idDe(hilo.empresa)
        data.autor = req.user!.id
        for (const a of data.adjuntos ?? []) {
          const adj = await req.payload.findByID({ collection: 'adjuntos', id: idDe(a)!, depth: 0, overrideAccess: true, req })
          if (String(idDe(adj.empresa)) !== String(data.empresa) || String(idDe(adj.subidoPor)) !== String(req.user!.id)) throw new APIError('Adjunto no válido.', 400, null, true)
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation !== 'create') return doc
        const hilo = (await req.payload.findByID({ collection: 'hilos', id: idDe(doc.hilo)!, depth: 1, overrideAccess: true, req })) as Hilo
        const autor = req.user as unknown as User
        // Un cliente que escribe en un hilo resuelto lo reabre.
        await req.payload.update({ collection: 'hilos', id: hilo.id, data: { ultimoMensaje: doc.createdAt, ...(!esSuperAdmin(autor) && hilo.estado === 'resuelto' ? { estado: 'abierto' } : {}) }, overrideAccess: true, req })
        await registrar(req, { accion: 'mensaje', descripcion: `Mensaje en «${hilo.asunto}»`, empresa: idDe(doc.empresa), coleccion: 'mensajes', registroId: doc.id, datos: { hilo: hilo.id } })

        // Participantes: quien abrió el hilo, quienes han escrito y la persona de CMC asignada (o los avisos de CMC).
        const previos = await req.payload.find({ collection: 'mensajes', where: { hilo: { equals: hilo.id } }, depth: 1, limit: 500, overrideAccess: true, req })
        const participantes = new Map<string, User>()
        for (const u of [hilo.creadoPor, hilo.asignado, ...previos.docs.map((m) => m.autor)]) if (u && typeof u === 'object') participantes.set(String(u.id), u as User)
        participantes.delete(String(autor.id))
        const para: { email: string; usuario?: number | string | null; tipo: 'cmc' | 'cliente' }[] = [...participantes.values()].filter((u) => u.activo !== false).map((u) => ({ email: u.email, usuario: u.id, tipo: (u.rol === 'superadmin' ? 'cmc' : 'cliente') as 'cmc' | 'cliente' }))
        if (!hilo.asignado && !esSuperAdmin(autor)) para.push(...(await destinatariosCMC(req)))
        const empresa = hilo.empresa as { razonSocial?: string }
        await programarCorreo(req, {
          plantilla: 'nuevo_mensaje',
          para: para.filter((d) => d.email !== autor.email),
          vars: { asunto: hilo.asunto, nombre: autor.nombre, empresa: empresa?.razonSocial, mensaje: String(doc.texto).slice(0, 600) },
          enlace: `${urlServidor()}/portal/mensajes/${hilo.id}`,
          empresa: idDe(doc.empresa),
          hilo: hilo.id,
        })
        return doc
      },
    ],
  },
  fields: [
    { name: 'hilo', type: 'relationship', relationTo: 'hilos', required: true, index: true },
    { name: 'texto', type: 'textarea', required: true },
    { name: 'adjuntos', type: 'relationship', relationTo: 'adjuntos', hasMany: true },
    { name: 'empresa', type: 'relationship', relationTo: 'empresas', index: true, admin: { readOnly: true } },
    { name: 'autor', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
  ],
}

/** Adjuntos de los mensajes. Un adjunto puede convertirse en un envío a revisión. */
export const Adjuntos: CollectionConfig = {
  slug: 'adjuntos',
  labels: { singular: 'Adjunto', plural: 'Adjuntos' },
  admin: { useAsTitle: 'filename', group: 'Clientes' },
  access: { read: porEmpresa(), create: crearConAcceso, update: nadie, delete: nadie },
  upload: { staticDir: dirSubidas('adjuntos'), mimeTypes: MIME_DOCUMENTOS, handlers: [registrarDescarga] },
  hooks: {
    beforeOperation: [comprimirImagenes],
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation !== 'create') return data
        if (!puedeVerEmpresa(req.user, idDe(data.empresa)!)) throw new APIError('No tiene acceso a esa empresa.', 403, null, true)
        data.subidoPor = req.user!.id
        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation === 'create') await registrar(req, { accion: 'subida', descripcion: `Adjunto «${doc.filename}»`, empresa: idDe(doc.empresa), coleccion: 'adjuntos', registroId: doc.id })
        return doc
      },
      guardarOriginal,
    ],
  },
  fields: [
    { name: 'empresa', type: 'relationship', relationTo: 'empresas', required: true, index: true },
    { name: 'subidoPor', type: 'relationship', relationTo: 'users', admin: { readOnly: true } },
    { name: 'tamanoOriginal', type: 'number', admin: { readOnly: true } },
  ],
}

/** Imágenes originales cuando la configuración pide conservarlas. Solo CMC. */
export const Originales: CollectionConfig = {
  slug: 'originales',
  labels: { singular: 'Imagen original', plural: 'Imágenes originales' },
  admin: { group: 'Plataforma', hidden: ({ user }) => !esSuperAdmin(user) },
  access: { read: soloSuperAdmin, create: nadie, update: nadie, delete: nadie },
  upload: { staticDir: dirSubidas('originales'), handlers: [registrarDescarga] },
  fields: [
    { name: 'coleccion', type: 'text' },
    { name: 'registroId', type: 'text', index: true },
    { name: 'empresa', type: 'relationship', relationTo: 'empresas', index: true },
  ],
}
