'use client'

import { FieldLabel, useField, useFormFields } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import { useEffect, useId, useState } from 'react'
import { nombreDeOpcion, opcionNueva } from '@/lib/catalogoCampo'

type Sugerencias = { opciones: { id: number | string; nombre: string }[]; exacta: string | null; similares: string[] }

/** Campo de texto con autocompletado del catálogo y aviso de nombres parecidos (RF-28). */
export const CampoCatalogo: TextFieldClientComponent = (props) => {
  const { path, field } = props
  const extra = props as unknown as { tipo: string; categoria?: string }
  const tipo = extra.tipo
  const categoria = useFormFields(([fields]) => {
    const valor = extra.categoria ? fields[extra.categoria]?.value : null
    if (valor && typeof valor === 'object' && 'id' in valor) return String((valor as { id: unknown }).id)
    return valor == null || valor === '' ? '' : String(valor)
  })
  const { value, setValue, showError, errorMessage } = useField<string>({ path })
  const [s, setS] = useState<Sugerencias>({ opciones: [], exacta: null, similares: [] })
  const lista = useId()

  useEffect(() => {
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      const q = new URLSearchParams({ tipo, q: value ?? '', ...(categoria ? { categoria } : {}) })
      fetch(`/api/catalogo/sugerencias?${q}`, { credentials: 'include', signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setS(d))
        .catch(() => null)
    }, 200)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [tipo, value, categoria])

  const nuevo = Boolean(value?.trim()) && !s.exacta
  return (
    <div className="field-type text" style={{ marginBottom: 'var(--base)' }}>
      <FieldLabel label={field.label} required={field.required} path={path} />
      <input className={showError ? 'error' : undefined} list={lista} value={value ?? ''} onChange={(e) => setValue(nombreDeOpcion(e.target.value))} style={{ width: '100%' }} />
      <datalist id={lista}>
        {s.opciones.map((o) => (
          <option key={o.id} value={o.nombre} />
        ))}
        {nuevo && <option value={opcionNueva(value ?? '')} />}
      </datalist>
      {s.exacta && s.exacta !== value && (
        <p style={{ margin: '4px 0 0' }}>
          Ya existe como <button type="button" className="btn--style-none" style={{ textDecoration: 'underline' }} onClick={() => setValue(s.exacta!)}>«{s.exacta}»</button>.
        </p>
      )}
      {nuevo && s.similares.length > 0 && (
        <p style={{ margin: '4px 0 0', color: 'var(--theme-warning-650)' }}>
          ¿Quiso decir{' '}
          {s.similares.map((n, i) => (
            <span key={n}>
              {i > 0 && ', '}
              <button type="button" className="btn--style-none" style={{ textDecoration: 'underline' }} onClick={() => setValue(n)}>«{n}»</button>
            </span>
          ))}
          ? Si no, se añadirá «{value}» al catálogo.
        </p>
      )}
      {showError && <p style={{ color: 'var(--theme-error-500)' }}>{errorMessage}</p>}
    </div>
  )
}
