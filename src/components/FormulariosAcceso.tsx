'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const mensajeDe = async (res: Response, def: string) => (await res.json().catch(() => null))?.errors?.[0]?.message ?? def

export function RecuperarForm() {
  const [enviado, setEnviado] = useState(false)
  const [cargando, setCargando] = useState(false)
  if (enviado) return <p role="status" className="alert alert--ok">Si el correo está registrado, recibirá un enlace para elegir una nueva contraseña. Caduca en 1 hora.</p>
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault()
        setCargando(true)
        const email = new FormData(e.currentTarget).get('email')
        await fetch('/api/users/forgot-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }).catch(() => null)
        setEnviado(true)
      }}
    >
      <div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <button className="btn btn--primary" disabled={cargando} style={{ justifyContent: 'center' }}>Enviar enlace</button>
      <a className="small" href="/portal/login">Volver al acceso</a>
    </form>
  )
}

/** Nueva contraseña desde el enlace de recuperación (token) o desde una invitación. */
export function NuevaPasswordForm({ token, invitacion }: { token?: string; invitacion?: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault()
        const f = new FormData(e.currentTarget)
        if (f.get('password') !== f.get('repetir')) return setError('Las contraseñas no coinciden.')
        setError(null)
        setCargando(true)
        const res = invitacion
          ? await fetch('/api/users/aceptar-invitacion', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: invitacion, password: f.get('password') }) })
          : await fetch('/api/users/reset-password', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password: f.get('password') }) })
        setCargando(false)
        if (!res.ok) return setError(await mensajeDe(res, 'El enlace no es válido o ha caducado.'))
        router.push(invitacion ? '/portal/login?bienvenida=1' : '/portal')
        router.refresh()
      }}
    >
      {error && <p role="alert" className="alert alert--error">{error}</p>}
      <div className="field"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required /></div>
      <div className="field"><label htmlFor="repetir">Repita la contraseña</label><input id="repetir" name="repetir" type="password" autoComplete="new-password" minLength={10} required /></div>
      <span className="hint">Al menos 10 caracteres, con letras y números.</span>
      <button className="btn btn--primary" disabled={cargando} style={{ justifyContent: 'center' }}>{invitacion ? 'Activar mi cuenta' : 'Guardar contraseña'}</button>
    </form>
  )
}

/** Consentimiento OAuth para un asistente de IA. */
export function AutorizarForm({ params }: { params: Record<string, string> }) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const decidir = (decision: 'permitir' | 'denegar') => async () => {
    setCargando(true)
    const res = await fetch('/api/oauth/autorizar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...params, decision }) })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json?.redirect) {
      setCargando(false)
      return setError(json?.error_description ?? 'No se ha podido completar la autorización.')
    }
    window.location.assign(json.redirect)
  }
  return (
    <div className="stack">
      {error && <p role="alert" className="alert alert--error">{error}</p>}
      <div className="row">
        <button type="button" className="btn btn--primary" disabled={cargando} onClick={decidir('permitir')}>Permitir acceso</button>
        <button type="button" className="btn btn--secondary" disabled={cargando} onClick={decidir('denegar')}>Cancelar</button>
      </div>
    </div>
  )
}
