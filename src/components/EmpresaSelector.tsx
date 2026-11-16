'use client'
import { usePathname, useRouter } from 'next/navigation'

export function EmpresaSelector({ empresas, activa }: { empresas: { id: string; nombre: string }[]; activa?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  if (empresas.length < 2) return null
  return (
    <div className="field">
      <label htmlFor="empresa" className="eyebrow" style={{ color: 'var(--ink-muted)' }}>Empresa</label>
      <select id="empresa" value={activa} onChange={(e) => router.push(`${pathname}?empresa=${e.target.value}`)}>
        {empresas.map((e) => (<option key={e.id} value={e.id}>{e.nombre}</option>))}
      </select>
    </div>
  )
}
