import type { Access, PayloadRequest, Where } from 'payload'

type Membership = { empresa: number | string | { id: number | string }; rol: 'admin' | 'usuario' }
type CmcUser = { id: number | string; rol?: 'superadmin' | 'cliente'; empresas?: Membership[] | null }

const idOf = (v: Membership['empresa']) => (typeof v === 'object' && v !== null ? v.id : v)

export const isSuperAdmin = (req: PayloadRequest): boolean =>
  (req.user as CmcUser | null)?.rol === 'superadmin'

/** IDs de las empresas a las que el usuario tiene acceso (opcionalmente solo como admin). */
export const empresasDe = (user: unknown, soloAdmin = false): (number | string)[] => {
  const u = user as CmcUser | null
  return (u?.empresas ?? [])
    .filter((m) => !soloAdmin || m.rol === 'admin')
    .map((m) => idOf(m.empresa))
}

export const soloSuperAdmin: Access = ({ req }) => isSuperAdmin(req)

/** Super admin: todo. Cliente: solo registros cuya `empresa` está entre las suyas (filtro aplicado en servidor). */
export const porEmpresa =
  (campo = 'empresa'): Access =>
  ({ req }) => {
    if (!req.user) return false
    if (isSuperAdmin(req)) return true
    const ids = empresasDe(req.user)
    if (!ids.length) return false
    return { [campo]: { in: ids } } as Where
  }

export const autenticado: Access = ({ req }) => Boolean(req.user)
