'use client'
import { usePathname, useRouter } from 'next/navigation'
import { Desplegable } from './Desplegable'

export function EmpresaSelector({ empresas, activa }: { empresas: { id: string; nombre: string }[]; activa?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  if (empresas.length < 2) return null
  return (
    <div className="field">
      <label className="eyebrow" style={{ color: 'var(--ink-muted)' }}>Empresa</label>
      <Desplegable
        key={activa}
        etiqueta="Empresa"
        opciones={empresas.map((e) => ({ valor: e.id, texto: e.nombre }))}
        valor={activa ?? ''}
        alCambiar={(v) => router.push(`${pathname}?empresa=${v}`)}
      />
    </div>
  )
}
