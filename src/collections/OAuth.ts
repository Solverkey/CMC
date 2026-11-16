import type { CollectionConfig } from 'payload'
import { esSuperAdmin, nadie, soloSuperAdmin } from '../access'

const oculto = { group: 'MCP', hidden: ({ user }: { user: unknown }) => !esSuperAdmin(user) }

/** Asistentes de IA registrados (registro dinámico de clientes OAuth). */
export const OAuthClientes: CollectionConfig = {
  slug: 'oauth-clientes',
  labels: { singular: 'Aplicación de IA', plural: 'Aplicaciones de IA' },
  admin: { ...oculto, useAsTitle: 'nombre' },
  access: { read: soloSuperAdmin, create: nadie, update: soloSuperAdmin, delete: nadie },
  fields: [
    { name: 'clientId', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'nombre', type: 'text', required: true },
    { name: 'redirectUris', type: 'json', required: true, admin: { readOnly: true } },
    { name: 'bloqueado', type: 'checkbox', defaultValue: false, admin: { description: 'Impide nuevas autorizaciones de esta aplicación.' } },
  ],
}

/** Códigos de autorización de un solo uso (10 minutos). */
export const OAuthCodigos: CollectionConfig = {
  slug: 'oauth-codigos',
  admin: { hidden: true },
  access: { read: nadie, create: nadie, update: nadie, delete: nadie },
  fields: [
    { name: 'hash', type: 'text', required: true, unique: true, index: true },
    { name: 'clientId', type: 'text', required: true },
    { name: 'usuario', type: 'relationship', relationTo: 'users', required: true },
    { name: 'redirectUri', type: 'text', required: true },
    { name: 'codeChallenge', type: 'text', required: true },
    { name: 'caduca', type: 'date', required: true },
    { name: 'usado', type: 'checkbox', defaultValue: false },
  ],
}
