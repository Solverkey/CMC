'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

export function MenuMovil({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  const ruta = usePathname()
  useEffect(() => {
    if (ref.current) ref.current.open = false
  }, [ruta])
  return (
    <details ref={ref} className="menu-movil">
      <summary className="btn btn--ghost" aria-label="Menú">
        <svg aria-hidden="true" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </summary>
      {children}
    </details>
  )
}
