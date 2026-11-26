import Link from 'next/link'
import { Suspense } from 'react'
import { listarHilos, ultimosMensajes } from '@/datos/consultas'
import type { Empresa, User } from '@/datos/tipos'
import { empresasDelUsuario } from '@/lib/payload'
import { Icon } from '../Icon'
import { FiltrosBandeja } from './FiltrosBandeja'

export type FiltrosComunicacion = { empresa?: string; estado?: string; mias?: string; q?: string }

const ZONA = 'Europe/Madrid'

/** Hoy: la hora. Este año: día y mes. Antes: la fecha completa. */
export function fechaCorta(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const dia = (x: Date) => x.toLocaleDateString('es-ES', { timeZone: ZONA })
  const ahora = new Date()
  if (dia(d) === dia(ahora)) return d.toLocaleTimeString('es-ES', { timeZone: ZONA, hour: '2-digit', minute: '2-digit' })
  const mismoAnio = d.toLocaleDateString('es-ES', { timeZone: ZONA, year: 'numeric' }) === ahora.toLocaleDateString('es-ES', { timeZone: ZONA, year: 'numeric' })
  return d.toLocaleDateString('es-ES', mismoAnio ? { timeZone: ZONA, day: 'numeric', month: 'short' } : { timeZone: ZONA, day: '2-digit', month: '2-digit', year: '2-digit' })
}

/** Cadena de filtros para que la bandeja se mantenga al abrir otra conversación. */
export function consultaFiltros(sp: FiltrosComunicacion) {
  const p = new URLSearchParams()
  for (const k of ['empresa', 'estado', 'mias', 'q'] as const) if (sp[k]) p.set(k, sp[k]!)
  const qs = p.toString()
  return qs ? `?${qs}` : ''
}

type Props = {
  user: User
  cmc: boolean
  sp: FiltrosComunicacion
  /** Conversación abierta a la derecha (id), «nuevo» o nada. */
  activo?: string | null
  children: React.ReactNode
}

/**
 * Comunicación como un correo: la lista de conversaciones a la izquierda y la conversación abierta a la derecha.
 * En el móvil se ve una cosa u otra.
 */
export async function Bandeja({ user, cmc, sp, activo, children }: Props) {
  const { empresas } = await empresasDelUsuario(user, sp.empresa)
  const estado = sp.estado === 'resuelto' || sp.estado === 'todos' ? sp.estado : 'abierto'

  const cond: string[] = []
  const params: unknown[] = []
  const p = (valor: unknown) => {
    params.push(valor)
    return `$${params.length}`
  }
  if (sp.empresa) cond.push(`empresa_id = ${p(Number(sp.empresa))}`)
  if (estado !== 'todos') cond.push(`estado = ${p(estado)}`)
  if (cmc && sp.mias) cond.push(`asignado_id = ${p(user.id)}`)
  if (sp.q?.trim()) {
    const texto = p(`%${sp.q.trim().toLowerCase()}%`)
    cond.push(`(LOWER(asunto) LIKE ${texto} OR EXISTS (SELECT 1 FROM mensajes mb WHERE mb.hilo_id = hilos.id AND LOWER(mb.texto) LIKE ${texto}))`)
  }
  const hilos = await listarHilos(user, `${cond.length ? `AND ${cond.join(' AND ')} ` : ''}ORDER BY ultimo_mensaje DESC LIMIT 200`, params)
  const ultimos = await ultimosMensajes(hilos.map((h) => h.id))
  const qs = consultaFiltros(sp)
  const variasEmpresas = cmc || empresas.length > 1

  return (
    <div className={`bandeja${activo ? ' bandeja--abierta' : ''}`}>
      <aside className="bandeja__lista" aria-label="Conversaciones">
        <div className="bandeja__cabeza">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h1 className="bandeja__titulo">Comunicación</h1>
            <Link className="btn btn--primary btn--sm" href={`/portal/mensajes/nuevo${qs}`} aria-current={activo === 'nuevo' ? 'page' : undefined}>
              <Icon name="chat" />Nueva
            </Link>
          </div>
          <Suspense>
            <FiltrosBandeja empresas={empresas.map((e) => ({ id: String(e.id), nombre: e.razonSocial }))} cmc={cmc} />
          </Suspense>
        </div>
        <ul className="bandeja__hilos">
          {hilos.length === 0 && (
            <li className="bandeja__vacia small muted">
              {sp.q || sp.empresa || sp.mias || estado !== 'abierto' ? (
                <>No hay conversaciones con estos filtros. <Link href="/portal/mensajes?estado=todos">Ver todas</Link></>
              ) : (
                <>No tiene conversaciones abiertas. <Link href="/portal/mensajes?estado=todos">Ver también las resueltas</Link> o empiece una nueva.</>
              )}
            </li>
          )}
          {hilos.map((h) => {
            const u = ultimos.get(h.id)
            const abierta = h.estado !== 'resuelto'
            // La pelota está en su tejado: el último mensaje es del otro lado.
            const pendiente = Boolean(abierta && u && (cmc ? !u.deCmc : u.deCmc))
            const sobre = typeof h.documento === 'object' && h.documento ? h.documento.titulo : typeof h.categoria === 'object' && h.categoria ? h.categoria.nombre : null
            const asignado = typeof h.asignado === 'object' && h.asignado ? h.asignado.nombre : null
            return (
              <li key={h.id}>
                <Link
                  href={`/portal/mensajes/${h.id}${qs}`}
                  className={`bandeja__hilo${pendiente ? ' bandeja__hilo--pendiente' : ''}`}
                  aria-current={activo === String(h.id) ? 'page' : undefined}
                >
                  <span className="bandeja__fila">
                    <span className="bandeja__asunto">{h.asunto}</span>
                    <time dateTime={u?.fecha ?? h.ultimoMensaje ?? undefined}>{fechaCorta(u?.fecha ?? h.ultimoMensaje)}</time>
                  </span>
                  {variasEmpresas && <span className="bandeja__empresa">{(h.empresa as Empresa)?.razonSocial}</span>}
                  {u && (
                    <span className="bandeja__extracto">
                      <strong>{u.deCmc && !cmc ? 'CMC' : (u.autor ?? 'Usuario')}:</strong> {u.texto}
                    </span>
                  )}
                  <span className="bandeja__marcas">
                    {pendiente && <span className="punto">{cmc ? 'Sin responder' : 'Respuesta de CMC'}</span>}
                    {!abierta && <span className="status status--verde">Resuelta</span>}
                    {sobre && <span className="tag" title={sobre}>{sobre}</span>}
                    {cmc && abierta && <span className="small muted">{asignado ?? 'Sin asignar'}</span>}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </aside>
      <section className="bandeja__detalle">{children}</section>
    </div>
  )
}
