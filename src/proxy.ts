import { NextResponse, type NextRequest } from 'next/server'

/**
 * El antiguo panel /admin ya no existe: todo se hace desde el portal. Los marcadores y enlaces viejos
 * llevan a la recuperación de contraseña o al portal (que pide iniciar sesión si hace falta).
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const destino = pathname.startsWith('/admin/forgot') || pathname.startsWith('/admin/reset') ? '/portal/recuperar' : '/portal'
  return NextResponse.redirect(new URL(destino, req.url))
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
