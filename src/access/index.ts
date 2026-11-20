type Membership = { empresa: number | string | { id: number | string }; rol: 'admin' | 'usuario' }
type Req = { user?: unknown }
export type CmcUser = {
  id: number | string
  collection?: string
  email?: string
  nombre?: string
  rol?: 'superadmin' | 'cliente'
  activo?: boolean | null
  totpActivo?: boolean | null
  empresas?: Membership[] | null
}

const idOf = (v: Membership['empresa']) => (typeof v === 'object' && v !== null ? v.id : v)

/** El doble factor es obligatorio para super administradores salvo que CMC_2FA_SUPERADMIN=opcional (también en producción, de forma temporal). */
export const dosFactorObligatorio = () => process.env.CMC_2FA_SUPERADMIN !== 'opcional'

const usuarioValido = (user: unknown): user is CmcUser => {
  const u = user as CmcUser | null
  return Boolean(u && (u.collection === undefined || u.collection === 'users') && u.activo !== false)
}

/** Super administrador con privilegios efectivos: sin doble factor activado no se le concede ninguno. */
export const esSuperAdmin = (user: unknown): boolean =>
  usuarioValido(user) && user.rol === 'superadmin' && (!dosFactorObligatorio() || user.totpActivo === true)

export const isSuperAdmin = (req: Req): boolean => esSuperAdmin(req.user)

export const superAdminSin2FA = (user: unknown): boolean =>
  usuarioValido(user) && user.rol === 'superadmin' && dosFactorObligatorio() && user.totpActivo !== true

/** IDs de las empresas a las que el usuario tiene acceso (opcionalmente solo como admin). */
export const empresasDe = (user: unknown, soloAdmin = false): (number | string)[] => {
  if (!usuarioValido(user)) return []
  return (user.empresas ?? []).filter((m) => !soloAdmin || m.rol === 'admin').map((m) => idOf(m.empresa))
}

export const rolEn = (user: unknown, empresa: number | string): 'admin' | 'usuario' | null => {
  if (!usuarioValido(user)) return null
  const m = (user.empresas ?? []).find((x) => String(idOf(x.empresa)) === String(empresa))
  return m?.rol ?? null
}

export const puedeVerEmpresa = (user: unknown, empresa: number | string) => esSuperAdmin(user) || rolEn(user, empresa) !== null
export const administraEmpresa = (user: unknown, empresa: number | string) => esSuperAdmin(user) || rolEn(user, empresa) === 'admin'

export const soloSuperAdmin = ({ req }: { req: Req }) => isSuperAdmin(req)
export const nadie = () => false

/**
 * Super admin: todo. Cliente: solo registros cuya `empresa` está entre las suyas y sigue activa.
 * El filtro se aplica en el servidor, en cualquier canal (portal, API o MCP).
 */
export const porEmpresa =
  (campo = 'empresa', soloAdmin = false) =>
  ({ req }: { req: Req }) => {
    if (!req.user) return false
    if (isSuperAdmin(req)) return true
    const ids = empresasDe(req.user, soloAdmin)
    if (!ids.length) return false
    return { and: [{ [campo]: { in: ids } }, { [`${campo}.activa`]: { equals: true } }] }
  }

export const autenticado = ({ req }: { req: Req }) => usuarioValido(req.user)
