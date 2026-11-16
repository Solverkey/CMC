'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { enviarConsulta, type EstadoConsulta } from '@/app/(frontend)/(web)/contacto/acciones'

type Props = { token: string; servicios: string[]; servicioInicial?: string; titular: string }

export function ContactoForm({ token, servicios, servicioInicial, titular }: Props) {
  const [estado, enviar, pendiente] = useActionState<EstadoConsulta, FormData>(enviarConsulta, null)
  if (estado?.ok) {
    return (
      <div className="card stack" role="status" style={{ flex: '1 1 480px', gap: 12 }}>
        <h2 style={{ fontSize: 26, lineHeight: '32px' }}>Gracias, hemos recibido su consulta</h2>
        <p className="muted">Le responderemos en un plazo de dos días laborables en el correo que nos ha indicado.</p>
      </div>
    )
  }
  const v = estado?.valores ?? {}
  const err = estado?.errores ?? {}
  const campo = (id: string) => ({ id: `c-${id}`, name: id, defaultValue: v[id], 'aria-invalid': err[id] ? true : undefined, 'aria-describedby': err[id] ? `c-${id}-error` : undefined })
  const fallo = (id: string) => (err[id] ? <span id={`c-${id}-error`} className="hint error">{err[id]}</span> : null)

  return (
    <form action={enviar} className="card stack" style={{ flex: '1 1 480px', minWidth: 0 }} aria-busy={pendiente} noValidate>
      <input type="hidden" name="token" value={token} />
      <div className="trampa" aria-hidden="true">
        <label htmlFor="c-web">No rellene este campo</label>
        <input id="c-web" name="web" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label htmlFor="c-nombre">Nombre</label>
          <input {...campo('nombre')} required autoComplete="name" maxLength={120} />
          {fallo('nombre')}
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label htmlFor="c-empresa">Empresa <span className="hint">(opcional)</span></label>
          <input {...campo('empresa')} autoComplete="organization" maxLength={160} />
        </div>
      </div>
      <div className="row" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label htmlFor="c-email">Correo electrónico</label>
          <input {...campo('email')} type="email" required autoComplete="email" maxLength={200} />
          {fallo('email')}
        </div>
        <div className="field" style={{ flex: '1 1 200px' }}>
          <label htmlFor="c-telefono">Teléfono <span className="hint">(opcional)</span></label>
          <input {...campo('telefono')} type="tel" autoComplete="tel" maxLength={30} />
          {fallo('telefono')}
        </div>
      </div>
      {servicios.length ? (
        <div className="field">
          <label htmlFor="c-servicio">Servicio de interés <span className="hint">(opcional)</span></label>
          <select {...campo('servicio')} defaultValue={v.servicio ?? servicioInicial ?? ''}>
            <option value="">Elija un servicio</option>
            {servicios.map((s) => <option key={s}>{s}</option>)}
            <option>Otro</option>
          </select>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="c-mensaje">¿En qué podemos ayudarle?</label>
        <textarea {...campo('mensaje')} rows={6} required maxLength={5000} />
        {fallo('mensaje')}
      </div>
      <div className="stack" style={{ gap: 4 }}>
        <div className="row small" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <input id="c-privacidad" name="privacidad" type="checkbox" required aria-invalid={err.privacidad ? true : undefined} style={{ marginTop: 3 }} />
          <label htmlFor="c-privacidad">
            He leído y acepto la <Link href="/privacidad">política de privacidad</Link>
          </label>
        </div>
        {fallo('privacidad')}
      </div>
      <p className="hint">
        Responsable: {titular}. Finalidad: responder a su consulta. Legitimación: su consentimiento. No se ceden datos a terceros. Puede ejercer sus derechos como se explica en la política de privacidad.
      </p>
      {estado?.error ? <p role="alert" className="alert alert--error">{estado.error}</p> : null}
      <div>
        <button className="btn btn--primary" type="submit" disabled={pendiente}>
          {pendiente ? 'Enviando…' : 'Enviar consulta'}
        </button>
      </div>
    </form>
  )
}
