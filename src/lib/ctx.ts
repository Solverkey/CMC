import type { User } from '@/datos/tipos'

export type Origen = 'web' | 'mcp' | 'sistema'

/** Petición del portal. Sustituye a PayloadRequest en los servicios. */
export type Ctx = {
  user: User | null
  headers: Headers
  origen: Origen
  context: Record<string, unknown>
}

export const ctxSistema = (): Ctx => ({ user: null, headers: new Headers(), origen: 'sistema', context: { origen: 'sistema' } })
