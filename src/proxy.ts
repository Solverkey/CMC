import { NextResponse, type NextRequest } from 'next/server'

// El acceso (con doble factor) y la recuperación de contraseña se hacen siempre desde el portal.
export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl
  const destino = pathname.startsWith('/admin/forgot') || pathname.startsWith('/admin/reset') ? '/portal/recuperar' : '/portal/login'
  const url = new URL(destino, req.url)
  if (destino === '/portal/login') url.searchParams.set('next', searchParams.get('redirect') || '/admin')
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/admin/login', '/admin/forgot', '/admin/reset/:path*', '/admin/create-first-user'],
}
