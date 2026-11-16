'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/users/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    })
    setCargando(false)
    if (!res.ok) {
      setError('Correo o contraseña incorrectos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.')
      return
    }
    router.push('/portal')
    router.refresh()
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      {error && <p role="alert" className="alert alert--error">{error}</p>}
      <div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      <button className="btn btn--primary" type="submit" disabled={cargando} style={{ justifyContent: 'center' }}>{cargando ? 'Entrando…' : 'Entrar'}</button>
      <a className="small" href="/admin/forgot">He olvidado mi contraseña</a>
    </form>
  )
}
