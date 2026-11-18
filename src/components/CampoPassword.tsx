'use client'
import { useState } from 'react'
import { Icon } from '@/components/Icon'

const cumple = (v: string) => v.length >= 10 && /[a-zA-Z]/.test(v) && /\d/.test(v)

/** Campo de contraseña con botón para mostrarla. Con `reglas`, el borde y la pista se ponen en verde al cumplirlas. */
export function CampoPassword({
  id,
  name,
  label,
  autoComplete = 'current-password',
  reglas = false,
  value,
  onChange,
  coincide,
  crece = false,
}: {
  id: string
  name: string
  label: string
  autoComplete?: string
  reglas?: boolean
  value?: string
  onChange?: (valor: string) => void
  /** Borde verde cuando este valor coincide con la contraseña ya válida. */
  coincide?: string
  /** Ocupa el espacio libre cuando va en una fila. */
  crece?: boolean
}) {
  const [ver, setVer] = useState(false)
  const [interno, setInterno] = useState('')
  const valor = value ?? interno
  const ok = reglas ? cumple(valor) : Boolean(coincide && cumple(coincide) && valor === coincide)

  return (
    <div className="field" style={crece ? { flex: '1 1 220px', minWidth: 0 } : undefined}>
      <label htmlFor={id}>{label}</label>
      <div className="clave-campo">
        <input
          id={id}
          name={name}
          type={ver ? 'text' : 'password'}
          autoComplete={autoComplete}
          required
          minLength={reglas || coincide !== undefined ? 10 : undefined}
          value={valor}
          onChange={(e) => {
            setInterno(e.target.value)
            onChange?.(e.target.value)
          }}
          className={ok ? 'campo--ok' : undefined}
        />
        <button type="button" className="clave-ver" aria-pressed={ver} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={() => setVer((v) => !v)}>
          <Icon name={ver ? 'eyeOff' : 'eye'} size={20} />
        </button>
      </div>
      {reglas && <span className={ok ? 'hint hint--ok' : 'hint'}>Al menos 10 caracteres, con letras y números.</span>}
    </div>
  )
}
