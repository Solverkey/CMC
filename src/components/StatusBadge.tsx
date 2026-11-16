import { ESTADOS, type Estado } from '@/lib/estado'

export function StatusBadge({ estado, count }: { estado?: Estado | null; count?: number }) {
  const e = (estado ?? 'verde') as Estado
  return (
    <span className={`status status--${e}`}>
      {ESTADOS[e].label}
      {typeof count === 'number' ? ` · ${count}` : ''}
    </span>
  )
}
