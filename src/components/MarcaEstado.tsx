import { ESTADOS, type Estado } from '@/lib/estado'

export function claseFila(estado?: Estado | null, tambien?: boolean) {
  const e = (estado ?? 'verde') as Estado
  const condicionada = Boolean(tambien && e !== 'naranja')
  return {
    className: `fila fila--${e}`,
    label: condicionada ? `${ESTADOS[e].label}. También condicionada` : ESTADOS[e].label,
  }
}
