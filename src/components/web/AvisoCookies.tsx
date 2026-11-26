'use client'

import { useEffect, useState } from 'react'

const CLAVE = 'cmc-consent'
const UN_ANO = 60 * 60 * 24 * 365

type Eleccion = { necesarias: true; analitica: boolean; marketing: boolean; cuando: string }

const leer = (): Eleccion | null => {
  if (typeof document === 'undefined') return null
  const cruda = document.cookie.split('; ').find((c) => c.startsWith(`${CLAVE}=`))?.slice(CLAVE.length + 1)
  if (!cruda) return null
  const [necesarias, analitica, marketing, cuando] = decodeURIComponent(cruda).split('.')
  if (necesarias !== '1' || !cuando) return null
  return { necesarias: true, analitica: analitica === '1', marketing: marketing === '1', cuando }
}

const guardar = (eleccion: Eleccion) => {
  const valor = ['1', eleccion.analitica ? '1' : '0', eleccion.marketing ? '1' : '0', eleccion.cuando].join('.')
  document.cookie = `${CLAVE}=${encodeURIComponent(valor)}; Max-Age=${UN_ANO}; Path=/; SameSite=Lax`
}

/** Banner de cookies (ePrivacy y RGPD): nada opcional se activa sin una elección previa, y rechazar es tan visible como aceptar. */
export function AvisoCookies() {
  const [visible, setVisible] = useState(false)
  const [detalle, setDetalle] = useState(false)
  const [analitica, setAnalitica] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    // La cookie solo existe en el navegador: se lee tras la hidratación para no pintar distinto en el servidor.
    const previa = leer()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!previa) setVisible(true)
    else {
      setAnalitica(previa.analitica)
      setMarketing(previa.marketing)
    }
    const abrir = () => {
      const actual = leer()
      setAnalitica(actual?.analitica ?? false)
      setMarketing(actual?.marketing ?? false)
      setDetalle(true)
      setVisible(true)
    }
    window.addEventListener('cmc-cookies-abrir', abrir)
    return () => window.removeEventListener('cmc-cookies-abrir', abrir)
  }, [])

  if (!visible) return null

  const cerrar = (siguiente: Pick<Eleccion, 'analitica' | 'marketing'>) => {
    guardar({ necesarias: true, ...siguiente, cuando: new Date().toISOString().slice(0, 10) })
    setVisible(false)
    setDetalle(false)
  }

  return (
    <div className="cookies" role="dialog" aria-labelledby="cookies-titulo" aria-describedby="cookies-texto">
      <div className="cookies__caja">
        <p id="cookies-titulo" className="cookies__titulo">Cookies</p>
        <p id="cookies-texto" className="small">
          Usamos una cookie técnica para recordar su elección y, si entra al portal, otra de sesión. Las de análisis y publicidad están apagadas y no se instalan salvo que las acepte. Puede cambiarlo cuando quiera desde el pie de la página.{' '}
          <a href="/cookies">Política de cookies</a>
        </p>
        {detalle && (
          <ul className="cookies__opciones">
            <li>
              <label><input type="checkbox" checked disabled /> Necesarias <span className="muted">Siempre activas. Recuerdan esta elección y mantienen la sesión del portal.</span></label>
            </li>
            <li>
              <label><input type="checkbox" checked={analitica} onChange={(e) => setAnalitica(e.target.checked)} /> Análisis <span className="muted">Ahora mismo no hay ninguna. Si se añade, solo se cargará con esta casilla.</span></label>
            </li>
            <li>
              <label><input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /> Publicidad <span className="muted">No usamos cookies de publicidad ni de terceros.</span></label>
            </li>
          </ul>
        )}
        <div className="cookies__acciones">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => cerrar({ analitica: false, marketing: false })}>Rechazar</button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => (detalle ? cerrar({ analitica, marketing }) : setDetalle(true))}>{detalle ? 'Guardar selección' : 'Configurar'}</button>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => cerrar({ analitica: true, marketing: true })}>Aceptar</button>
        </div>
      </div>
    </div>
  )
}

export const abrirCookies = () => window.dispatchEvent(new Event('cmc-cookies-abrir'))
