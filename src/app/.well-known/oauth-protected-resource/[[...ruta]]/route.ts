import { metadatosRecurso } from '@/mcp/oauth'

export const GET = () => Response.json(metadatosRecurso(), { headers: { 'Access-Control-Allow-Origin': '*' } })
