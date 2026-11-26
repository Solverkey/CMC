'use client'

import { useState } from 'react'
import { urlDelSitio } from '@/lib/urlFichero'

/** Baja el archivo solo cuando se pulsa. La vista previa no debe disparar la descarga. Si falla, lo dice. */
export function BotonDescarga({ url, nombre, className, children }: { url: string; nombre?: string | null; className?: string; children: React.ReactNode }) {
  const [descargando, setDescargando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  async function descargar() {
    setFallo(null)
    setDescargando(true)
    try {
      const propia = urlDelSitio(url)
      const destino = `${propia}${propia.includes('?') ? '&' : '?'}descarga=1`
      const res = await fetch(destino, { credentials: 'include' })
      if (!res.ok) {
        const motivo = (await res.json().catch(() => null))?.errors?.[0]?.message
        setFallo(motivo ?? (res.status === 401 ? 'Su sesión ha caducado. Vuelva a entrar.' : 'No se ha podido descargar el archivo.'))
        return
      }
      const blob = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = blob
      a.download = nombre || 'archivo'
      a.click()
      URL.revokeObjectURL(blob)
    } catch {
      setFallo('No se ha podido descargar el archivo. Compruebe la conexión.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={descargar} disabled={descargando} aria-busy={descargando}>
        {children}
      </button>
      {fallo && <span role="alert" className="small error" style={{ display: 'block' }}>{fallo}</span>}
    </>
  )
}
