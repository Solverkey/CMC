'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Solo rutas internas, para no redirigir fuera del portal. */
const destinoSeguro = (next?: string) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/portal')

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  const [pedirCodigo, setPedirCodigo] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setCargando(true)
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/users/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), password: form.get('password'), codigo: form.get('codigo') || undefined }),
    })
    setCargando(false)
    if (!res.ok) {
      const err = (await res.json().catch(() => null))?.errors?.[0]
      if (err?.data?.requiere2fa) {
        if (pedirCodigo) setError(err.message)
        setPedirCodigo(true)
        return
      }
      setError(res.status === 403 && err?.message ? err.message : 'Correo o contraseña incorrectos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.')
      return
    }
    const destino = destinoSeguro(next)
    if (destino.startsWith('/admin')) window.location.assign(destino)
    else {
      router.push(destino)
      router.refresh()
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      {error && <p role="alert" className="alert alert--error">{error}</p>}
      <div className="field" hidden={pedirCodigo}><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field" hidden={pedirCodigo}><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
      {pedirCodigo && (
        <div className="field">
          <label htmlFor="codigo">Código de verificación</label>
          <input id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus />
          <span className="hint">Escriba el código de 6 cifras de su aplicación de autenticación.</span>
        </div>
      )}
      <button className="btn btn--primary" type="submit" disabled={cargando} style={{ justifyContent: 'center' }}>{cargando ? 'Comprobando…' : pedirCodigo ? 'Verificar' : 'Entrar'}</button>
      {pedirCodigo ? (
        <button type="button" className="enlace small" onClick={() => { setPedirCodigo(false); setError(null) }}>Volver</button>
      ) : (
        <a className="small" href="/portal/recuperar">He olvidado mi contraseña</a>
      )}
    </form>
  )
}
