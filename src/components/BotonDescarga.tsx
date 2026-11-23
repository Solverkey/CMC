'use client'

/** Baja el archivo solo cuando se pulsa. La vista previa no debe disparar la descarga. */
export function BotonDescarga({ url, nombre, className, children }: { url: string; nombre?: string | null; className?: string; children: React.ReactNode }) {
  async function descargar() {
    const destino = `${url}${url.includes('?') ? '&' : '?'}descarga=1`
    const res = await fetch(destino, { credentials: 'include' })
    if (!res.ok) return
    const blob = URL.createObjectURL(await res.blob())
    const a = document.createElement('a')
    a.href = blob
    a.download = nombre || 'archivo'
    a.click()
    URL.revokeObjectURL(blob)
  }

  return (
    <button type="button" className={className} onClick={descargar}>
      {children}
    </button>
  )
}
