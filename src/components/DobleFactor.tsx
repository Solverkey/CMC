'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CampoPassword } from '@/components/CampoPassword'

const post = async (ruta: string, body?: unknown) => {
  const res = await fetch(`/api/users/2fa/${ruta}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new Error(json?.errors?.[0]?.message ?? 'No se ha podido completar.')
  return json
}

/** Alta y baja del doble factor con una aplicación de autenticación (RF-01). */
export function DobleFactor({ activo, obligatorio }: { activo: boolean; obligatorio: boolean }) {
  const router = useRouter()
  const [alta, setAlta] = useState<{ qr: string; secreto: string } | null>(null)
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)

  const ejecutar = (fn: () => Promise<void>) => async () => {
    setMsg(null)
    try {
      await fn()
    } catch (e) {
      setMsg({ error: (e as Error).message })
    }
  }

  const codigoDe = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value.trim() ?? ''

  if (activo)
    return (
      <div className="stack">
        <p><span className="status status--verde">Activado</span> Al entrar se le pedirá el código de 6 cifras de su aplicación.</p>
        {!obligatorio && (
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field"><label htmlFor="cod-baja">Código actual</label><input id="cod-baja" inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></div>
            <button type="button" className="btn btn--secondary" onClick={ejecutar(async () => { await post('desactivar', { codigo: codigoDe('cod-baja') }); router.refresh() })}>Desactivar</button>
          </div>
        )}
        {msg?.error && <p role="alert" className="alert alert--error">{msg.error}</p>}
      </div>
    )

  return (
    <div className="stack">
      {!alta ? (
        <div><button type="button" className="btn btn--primary" onClick={ejecutar(async () => setAlta(await post('iniciar')))}>Activar doble factor</button></div>
      ) : (
        <div className="row" style={{ alignItems: 'flex-start', gap: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={alta.qr} alt="Código QR para la aplicación de autenticación" width={220} height={220} />
          <div className="stack" style={{ flex: '1 1 260px' }}>
            <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
              <li>Abra su aplicación de autenticación (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
              <li>Escanee el código QR o introduzca la clave: <code>{alta.secreto}</code></li>
              <li>Escriba el código de 6 cifras que le muestra.</li>
            </ol>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="field"><label htmlFor="cod-alta">Código</label><input id="cod-alta" inputMode="numeric" autoComplete="one-time-code" maxLength={6} /></div>
              <button type="button" className="btn btn--primary" onClick={ejecutar(async () => { await post('activar', { codigo: codigoDe('cod-alta') }); setAlta(null); router.refresh() })}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
      {msg?.error && <p role="alert" className="alert alert--error">{msg.error}</p>}
    </div>
  )
}

/** Cambio de contraseña de la propia cuenta. */
export function CambiarPassword({ id }: { id: string }) {
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null)
  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault()
        if (password !== repetir) return setMsg({ error: 'Las contraseñas no coinciden.' })
        const res = await fetch(`/api/users/${id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
        const json = await res.json().catch(() => null)
        setMsg(res.ok ? { ok: 'Contraseña cambiada.' } : { error: json?.errors?.[0]?.message ?? 'No se ha podido cambiar.' })
        if (res.ok) {
          setPassword('')
          setRepetir('')
        }
      }}
    >
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <CampoPassword id="password" name="password" label="Nueva contraseña" autoComplete="new-password" reglas value={password} onChange={setPassword} crece />
        <CampoPassword id="repetir" name="repetir" label="Repítala" autoComplete="new-password" value={repetir} onChange={setRepetir} coincide={password} crece />
        <button className="btn btn--secondary" style={{ marginTop: 26 }}>Cambiar</button>
      </div>
      {msg?.error && <p role="alert" className="alert alert--error">{msg.error}</p>}
      {msg?.ok && <p role="status" className="alert alert--ok">{msg.ok}</p>}
    </form>
  )
}
