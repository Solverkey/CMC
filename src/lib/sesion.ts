import { cache } from 'react'
import { cookies } from 'next/headers'
import { abrirSesion, cerrarSesion, usuarioPorSesion } from '@/datos/usuarios'
import type { User } from '@/datos/tipos'

export const COOKIE = 'cmc-sesion'

const opciones = (expira: Date) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  expires: expira,
})

export const leerSesion = cache(async function leerSesion(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  return usuarioPorSesion(token)
})

export async function escribirSesion(userId: number) {
  const s = await abrirSesion(userId)
  ;(await cookies()).set(COOKIE, s.id, opciones(new Date(s.expira)))
}

export async function borrarSesion() {
  const jar = await cookies()
  const token = jar.get(COOKIE)?.value
  if (token) await cerrarSesion(token)
  jar.set(COOKIE, '', { ...opciones(new Date(0)), maxAge: 0 })
}
