import { Enlace as Link } from '@/components/Enlace'
import { notFound } from 'next/navigation'
import { empresasDe } from '@/access'
import { contar, filtroActividad, listarActividad } from '@/datos/consultas'
import type { Empresa } from '@/datos/tipos'
import { ACCIONES } from '@/lib/actividad'
import { fechaValida } from '@/servicios/documentos'
import { contexto, empresasDelUsuario, fmtHora } from '@/lib/payload'
import { Desplegable } from '@/components/Desplegable'

export const metadata = { title: 'Registro de actividad' }

const ETIQUETA = new Map<string, string>(ACCIONES.map((a) => [a.value, a.label]))
const ORIGEN: Record<string, string> = { web: 'Portal', mcp: 'Asistente de IA', sistema: 'Sistema' }

export default async function ActividadPage({ searchParams }: { searchParams: Promise<{ empresa?: string; accion?: string; email?: string; desde?: string; hasta?: string; origen?: string; pagina?: string }> }) {
  const sp = await searchParams
  const { user, cmc } = await contexto('/portal/actividad')
  // Como en el menú: solo CMC y los administradores de empresa.
  if (!cmc && !empresasDe(user, true).length) notFound()
  const administradas = new Set(empresasDe(user, true).map(String))
  const empresas = (await empresasDelUsuario(user)).empresas.filter((e) => cmc || administradas.has(String(e.id)))
  const pagina = Math.max(Number(sp.pagina) || 1, 1)

  const cond: string[] = []
  const params: unknown[] = []
  const add = (sql: string, valor: unknown) => {
    params.push(valor)
    cond.push(sql.replace('?', `$${params.length}`))
  }
  if (sp.empresa) add('empresa_id = ?', Number(sp.empresa))
  if (sp.accion) add('accion = ?', sp.accion)
  if (sp.origen) add('origen = ?', sp.origen)
  if (sp.email) add('LOWER(email) LIKE ?', `%${sp.email.toLowerCase()}%`)
  const desde = fechaValida(sp.desde)
  const hasta = fechaValida(sp.hasta, 'T23:59:59')
  if (desde) add('created_at >= ?', desde)
  if (hasta) add('created_at <= ?', hasta)
  const extra = cond.length ? `AND ${cond.join(' AND ')}` : ''
  const filtro = `${filtroActividad(user)} ${extra}`
  const [docs, totalDocs] = await Promise.all([
    listarActividad(user, extra, params, 100, (pagina - 1) * 100),
    contar('actividad', filtro, params),
  ])
  const r = { docs, totalDocs, totalPages: Math.max(Math.ceil(totalDocs / 100), 1), hasPrevPage: pagina > 1, hasNextPage: pagina * 100 < totalDocs }
  const enlace = (p: number) => `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), pagina: String(p) })}`

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{r.totalDocs} registros</p>
        <h1>Registro de actividad</h1>
        <p className="muted">Accesos, subidas, descargas, cambios de estado y correos. El registro no se puede modificar ni borrar.</p>
      </div>

      <form className="card filtros" role="search">
        {(cmc || empresas.length > 1) && (
          <div className="field">
            <label>Empresa</label>
            <Desplegable name="empresa" etiqueta="Empresa" vacia="Todas" opciones={empresas.map((e) => ({ valor: String(e.id), texto: e.razonSocial }))} valor={sp.empresa ?? ''} />
          </div>
        )}
        <div className="field">
          <label htmlFor="accion">Acción</label>
          <select id="accion" name="accion" defaultValue={sp.accion ?? ''}>
            <option value="">Todas</option>
            {ACCIONES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="origen">Origen</label>
          <select id="origen" name="origen" defaultValue={sp.origen ?? ''}>
            <option value="">Todos</option>
            {Object.entries(ORIGEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="email">Usuario</label><input id="email" name="email" defaultValue={sp.email} placeholder="correo" /></div>
        <div className="field"><label htmlFor="desde">Desde</label><input id="desde" name="desde" type="date" defaultValue={sp.desde} /></div>
        <div className="field"><label htmlFor="hasta">Hasta</label><input id="hasta" name="hasta" type="date" defaultValue={sp.hasta} /></div>
        <button className="btn btn--secondary">Filtrar</button>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Fecha</th><th>Acción</th><th>Descripción</th><th>Usuario</th><th>Origen</th></tr></thead>
          <tbody>
            {r.docs.length === 0 && <tr><td colSpan={5} className="muted">Sin registros.</td></tr>}
            {r.docs.map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtHora(a.createdAt)}</td>
                <td><span className="tag">{ETIQUETA.get(a.accion) ?? a.accion}</span></td>
                <td>{a.descripcion}{a.empresa && typeof a.empresa === 'object' && (cmc || empresas.length > 1) && <span className="muted" style={{ display: 'block' }}>{(a.empresa as Empresa).razonSocial}</span>}</td>
                <td>{a.email ?? <span className="muted">—</span>}{cmc && a.ip && <span className="muted" style={{ display: 'block' }}>{a.ip}</span>}</td>
                <td>{ORIGEN[a.origen ?? 'web']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.totalPages > 1 && (
        <nav className="row" aria-label="Páginas">
          {r.hasPrevPage && <Link className="btn btn--secondary btn--sm" href={enlace(pagina - 1)}>Anterior</Link>}
          <span className="small muted">Página {pagina} de {r.totalPages}</span>
          {r.hasNextPage && <Link className="btn btn--secondary btn--sm" href={enlace(pagina + 1)}>Siguiente</Link>}
        </nav>
      )}
    </>
  )
}
