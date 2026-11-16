import { metadatosServidor } from '@/mcp/oauth'

export const GET = () => Response.json(metadatosServidor(), { headers: { 'Access-Control-Allow-Origin': '*' } })
