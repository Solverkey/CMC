'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

const TROZO_SEGUNDOS = 5

/** Pasa de un clip a otro cada 5 segundos. Con un solo vídeo lo reproduce entero y lo repite. */
export function CarruselPortada({ fuentes, children }: { fuentes: string[]; children: ReactNode }) {
  const ref = useRef<HTMLVideoElement>(null)
  const progreso = useRef<number[]>([])
  const [indice, setIndice] = useState(0)
  const [reducido, setReducido] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducido(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const video = ref.current
    if (!video || reducido || fuentes.length < 2) return
    let vivo = true
    const origen = progreso.current[indice] || 0

    const preparar = () => {
      if (!vivo) return
      const duracion = Number.isFinite(video.duration) ? video.duration : 0
      const inicio = duracion && origen >= duracion - 0.25 ? 0 : origen
      progreso.current[indice] = inicio
      if (Math.abs(video.currentTime - inicio) > 0.2) video.currentTime = inicio
      video.play().catch(() => {})
    }

    const pasar = () => {
      const duracion = Number.isFinite(video.duration) ? video.duration : 0
      const inicio = progreso.current[indice] || 0
      const agotado = duracion > 0 && video.currentTime >= duracion - 0.2
      if (!agotado && video.currentTime < inicio + TROZO_SEGUNDOS) return
      progreso.current[indice] = agotado ? 0 : video.currentTime
      setIndice((n) => (n + 1) % fuentes.length)
    }

    video.src = fuentes[indice]
    video.addEventListener('loadedmetadata', preparar)
    video.addEventListener('timeupdate', pasar)
    video.addEventListener('ended', pasar)
    return () => {
      vivo = false
      video.removeEventListener('loadedmetadata', preparar)
      video.removeEventListener('timeupdate', pasar)
      video.removeEventListener('ended', pasar)
    }
  }, [indice, fuentes, reducido])

  if (reducido || fuentes.length === 0) return children
  if (fuentes.length === 1) {
    return <video className="hero__video" src={fuentes[0]} muted playsInline autoPlay loop preload="metadata" aria-hidden="true" />
  }
  return <video ref={ref} className="hero__video" muted playsInline autoPlay preload="auto" aria-hidden="true" />
}
