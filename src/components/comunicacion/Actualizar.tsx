'use client'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** Mientras la pestaña está visible, trae los mensajes nuevos cada cierto tiempo y al volver a ella. */
export function Actualizar({ cada = 30_000 }: { cada?: number }) {
  const router = useRouter()
  useEffect(() => {
    const tic = () => {
      if (document.visibilityState === 'visible') router.refresh()
    }
    const reloj = setInterval(tic, cada)
    document.addEventListener('visibilitychange', tic)
    return () => {
      clearInterval(reloj)
      document.removeEventListener('visibilitychange', tic)
    }
  }, [cada, router])
  return null
}
