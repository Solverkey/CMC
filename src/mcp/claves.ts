import type { CollectionConfig, PayloadRequest } from 'payload'
import { APIError, UnauthorizedError } from 'payload'
import { esSuperAdmin } from '../access'
import { registrar } from '../lib/actividad'
import { hash, tokenAleatorio } from '../lib/cifrado'

export const COLECCION_CLAVES = 'payload-mcp-api-keys'
export const HORAS_ACCESO = 8
export const DIAS_RENOVACION = 30
const LIMITE_MINUTO = 60
const LIMITE_DIA = 3000

/** Claves de acceso MCP: cada usuario ve y revoca las suyas; CMC, todas. */
export const ajustarColeccionClaves = (c: CollectionConfig): CollectionConfig => ({
  ...c,
  labels: { singular: 'Acceso de IA', plural: 'Accesos de IA (MCP)' },
  admin: { ...c.admin, group: 'MCP', useAsTitle: 'label', defaultColumns: ['label', 'user', 'origen', 'caduca', 'ultimoUso'], description: 'Accesos de asistentes de IA. Cada uno actúa con los permisos de su usuario. Borrar = revocar.' },
  access: {
    ...c.access,
    read: ({ req }) => (esSuperAdmin(req.user) ? true : req.user?.collection === 'users' ? { user: { equals: req.user.id } } : false),
    delete: ({ req }) => (esSuperAdmin(req.user) ? true : req.user?.collection === 'users' ? { user: { equals: req.user.id } } : false),
    create: () => false,
    update: ({ req }) => esSuperAdmin(req.user),
  },
  hooks: {
    ...c.hooks,
    afterDelete: [
      async ({ doc, req }) => {
        await registrar(req, { accion: 'seguridad', descripcion: `Revocado el acceso de IA «${doc.label ?? doc.id}»`, coleccion: COLECCION_CLAVES, registroId: doc.id })
      },
    ],
  },
  fields: [
    ...c.fields,
    {
      name: 'origen',
      type: 'select',
      defaultValue: 'manual',
      options: [
        { label: 'Autorización OAuth', value: 'oauth' },
        { label: 'Clave creada en el portal', value: 'manual' },
      ],
      admin: { readOnly: true, position: 'sidebar' },
    },
    { name: 'clientId', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    { name: 'caduca', type: 'date', admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'renovacionHash', type: 'text', hidden: true, index: true },
    { name: 'renovacionCaduca', type: 'date', hidden: true },
    { name: 'ultimoUso', type: 'date', admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } } },
  ],
})

/** Crea un acceso de IA para el usuario. Devuelve la clave en claro, que solo se muestra una vez. */
export async function crearClave(req: PayloadRequest, d: { usuario: number | string; label: string; origen: 'oauth' | 'manual'; clientId?: string; dias?: number }) {
  const apiKey = `cmc_${tokenAleatorio(32)}`
  const renovacion = d.origen === 'oauth' ? tokenAleatorio(32) : undefined
  const ahora = Date.now()
  const doc = await req.payload.create({
    collection: COLECCION_CLAVES,
    overrideAccess: true,
    req,
    data: {
      user: d.usuario,
      label: d.label,
      enableAPIKey: true,
      apiKey,
      origen: d.origen,
      clientId: d.clientId,
      caduca: new Date(ahora + (d.origen === 'oauth' ? HORAS_ACCESO * 3600_000 : (d.dias ?? 90) * 86400_000)).toISOString(),
      ...(renovacion ? { renovacionHash: hash(renovacion), renovacionCaduca: new Date(ahora + DIAS_RENOVACION * 86400_000).toISOString() } : {}),
    } as never,
  })
  await registrar(req, { accion: 'seguridad', descripcion: `Nuevo acceso de IA «${d.label}» (${d.origen === 'oauth' ? 'OAuth' : 'clave'})`, coleccion: COLECCION_CLAVES, registroId: doc.id, usuario: { id: d.usuario } })
  return { id: doc.id, apiKey, renovacion, expiresIn: d.origen === 'oauth' ? HORAS_ACCESO * 3600 : undefined }
}

/** Renueva un acceso OAuth: rota la clave y el token de renovación. */
export async function renovarClave(req: PayloadRequest, renovacion: string, clientId: string) {
  const { docs } = await req.payload.find({ collection: COLECCION_CLAVES, where: { renovacionHash: { equals: hash(renovacion) } }, limit: 1, depth: 0, overrideAccess: true, showHiddenFields: true, req })
  const k = docs[0] as Record<string, any> | undefined
  if (!k || k.clientId !== clientId || !k.renovacionCaduca || new Date(k.renovacionCaduca) < new Date()) throw new APIError('invalid_grant', 400)
  const apiKey = `cmc_${tokenAleatorio(32)}`
  const nueva = tokenAleatorio(32)
  await req.payload.update({
    collection: COLECCION_CLAVES,
    id: k.id,
    overrideAccess: true,
    req,
    data: { apiKey, enableAPIKey: true, caduca: new Date(Date.now() + HORAS_ACCESO * 3600_000).toISOString(), renovacionHash: hash(nueva), renovacionCaduca: new Date(Date.now() + DIAS_RENOVACION * 86400_000).toISOString() } as never,
  })
  return { apiKey, renovacion: nueva, expiresIn: HORAS_ACCESO * 3600 }
}

const camel = (s: string) => s.replace(/[-_\s]+(.)?/g, (_, c: string) => (c ? c.toUpperCase() : '')).replace(/^(.)/, (_, c: string) => c.toLowerCase())

const usos = new Map<string, { minuto: number; enMinuto: number; dia: string; enDia: number }>()

/** Comprobaciones de cada petición MCP: caducidad, usuario activo y límites de uso por acceso. */
export async function comprobarAcceso(req: PayloadRequest, ajustes: Record<string, any>, herramientas: string[]) {
  if (ajustes.caduca && new Date(ajustes.caduca) < new Date()) throw new UnauthorizedError()
  const ref = ajustes.user as { id?: number | string; _strategy?: string } | undefined
  const user = ref?.id ? await req.payload.findByID({ collection: 'users', id: ref.id, depth: 0, overrideAccess: true, req }).catch(() => null) : null
  if (!user || user.activo === false) throw new UnauthorizedError()
  ajustes.user = { ...user, collection: 'users', _strategy: ref?._strategy ?? 'mcp-api-key' }

  const id = String(ajustes.id)
  const ahora = Date.now()
  const minuto = Math.floor(ahora / 60_000)
  const dia = new Date().toISOString().slice(0, 10)
  const u = usos.get(id) ?? { minuto, enMinuto: 0, dia, enDia: 0 }
  if (u.minuto !== minuto) Object.assign(u, { minuto, enMinuto: 0 })
  if (u.dia !== dia) Object.assign(u, { dia, enDia: 0 })
  u.enMinuto++
  u.enDia++
  usos.set(id, u)
  if (u.enMinuto > LIMITE_MINUTO || u.enDia > LIMITE_DIA) throw new APIError('Se ha superado el límite de uso del acceso de IA. Inténtelo más tarde.', 429, null, true)

  if (!ajustes.ultimoUso || ahora - new Date(ajustes.ultimoUso).getTime() > 5 * 60_000) {
    await req.payload.db.updateOne({ collection: COLECCION_CLAVES, id: ajustes.id, data: { ultimoUso: new Date().toISOString() }, req }).catch(() => null)
  }
  req.context.origen = 'mcp'
  // Los permisos reales los aplica el control de acceso de cada colección con el usuario del acceso.
  ajustes['payload-mcp-tool'] = Object.fromEntries(herramientas.map((h) => [camel(h), true]))
  return ajustes
}
