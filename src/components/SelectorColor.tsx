'use client'

import { useState } from 'react'

const hex = (valor: string) => {
  const v = valor.trim()
  if (/^#[0-9a-f]{3}$/i.test(v)) return `#${v.slice(1).split('').map((c) => c + c).join('')}`.toLowerCase()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase()
  return '#4d6162'
}

const tinta = (valor: string) => {
  const n = Number.parseInt(valor.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#1e2a2b' : '#ffffff'
}

export function SelectorColor({ valor }: { valor: string }) {
  const [color, setColor] = useState(hex(valor))

  return (
    <div className="field" style={{ flex: '0 0 auto' }}>
      <label htmlFor="colorElegido">Color</label>
      <div className="muestra-color" style={{ background: color, color: tinta(color) }}>
        {color}
        <input id="colorElegido" className="color-nativo" type="color" aria-label="Cambiar el color" value={color} onChange={(e) => setColor(hex(e.target.value))} />
      </div>
      <input type="hidden" name="colorPrimario" value={color} readOnly />
    </div>
  )
}
