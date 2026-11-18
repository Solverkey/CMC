import Link from 'next/link'
import { BotonZip, MarcarTodos } from '@/components/BotonZip'
import { Icon } from '@/components/Icon'
import { StatusBadge } from '@/components/StatusBadge'
import { ESTADOS, resolverGestion, type Estado } from '@/lib/estado'
import { contexto, diasHasta, empresasDelUsuario, fmt } from '@/lib/payload'
import type { Categoria, Documento, Empresa } from '@/payload-types'
import { buscarDocumentos } from '@/servicios/documentos'

export const metadata = { title: 'Documentos' }

type SP = { q?: string; empresa?: string; categoria?: string; estado?: string | string[]; desde?: string; hasta?: string; pagina?: string; orden?: string }

const FILTROS: Estado[] = ['verde', 'amarillo', 'naranja', 'rojo', 'azul', 'negro']

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const { payload, user, req } = await contexto('/portal/documentos')
  const { empresas } = await empresasDelUsuario(user)
  const estados = ([] as string[]).concat(sp.estado ?? []).filter(Boolean) as Estado[]
  const pagina = Math.max(Number(sp.pagina) || 1, 1)

  const [r, categorias] = await Promise.all([
    buscarDocumentos(req, { q: sp.q, empresa: sp.empresa, categoria: sp.categoria, estados, desde: sp.desde, hasta: sp.hasta, limite: 50, pagina, orden: sp.orden || 'fechaCaducidad' }),
    sp.empresa ? payload.find({ collection: 'categorias', where: { empresa: { equals: sp.empresa } }, user, overrideAccess: false, depth: 0, limit: 500, sort: 'nombre' }) : null,
  ])
  const docs = r.docs as Documento[]
  const enlace = (p: number) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) for (const x of ([] as string[]).concat(v ?? [])) if (k !== 'pagina') u.append(k, x)
    u.set('pagina', String(p))
    return `?${u}`
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div className="stack" style={{ gap: 4 }}>
          <p className="small muted">{r.totalDocs} documentos</p>
          <h1>Buscar documentos</h1>
        </div>
        {sp.empresa && (
          <div className="row">
            <a href={`/api/inventario/${sp.empresa}?formato=xlsx`} className="btn btn--secondary btn--sm"><Icon name="download" />Excel</a>
            <a href={`/api/inventario/${sp.empresa}?formato=pdf`} className="btn btn--secondary btn--sm"><Icon name="download" />PDF</a>
          </div>
        )}
      </div>

      <form className="card stack" role="search" style={{ gap: 12 }}>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '2 1 260px' }}>
            <label htmlFor="q">Texto</label>
            <input id="q" name="q" defaultValue={sp.q} placeholder="Nombre, referencia, organismo…" />
          </div>
          {empresas.length > 1 && (
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label htmlFor="empresa">Empresa</label>
              <select id="empresa" name="empresa" defaultValue={sp.empresa ?? ''}>
                <option value="">Todas</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.razonSocial}</option>)}
              </select>
            </div>
          )}
          {categorias && (
            <div className="field" style={{ flex: '1 1 200px' }}>
              <label htmlFor="categoria">Categoría</label>
              <select id="categoria" name="categoria" defaultValue={sp.categoria ?? ''}>
                <option value="">Todas</option>
                {categorias.docs.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="desde">Caduca desde</label>
            <input id="desde" name="desde" type="date" defaultValue={sp.desde} />
          </div>
          <div className="field">
            <label htmlFor="hasta">hasta</label>
            <input id="hasta" name="hasta" type="date" defaultValue={sp.hasta} />
          </div>
        </div>
        <fieldset className="row" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">Estado</legend>
          {FILTROS.map((e) => (
            <label key={e} className="row small" style={{ gap: 6 }}>
              <input type="checkbox" name="estado" value={e} defaultChecked={estados.includes(e)} />
              <span className={`status status--${e}`}>{ESTADOS[e].label}</span>
            </label>
          ))}
          <button className="btn btn--primary btn--sm" style={{ marginLeft: 'auto' }}><Icon name="search" />Buscar</button>
        </fieldset>
      </form>

      <form id="seleccion" className="stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <BotonZip formId="seleccion" />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 32 }}><MarcarTodos formId="seleccion" /></th>
                <th>Documento</th>
                {empresas.length > 1 && <th>Empresa</th>}
                <th>Categoría</th>
                <th>Caducidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {docs.length === 0 && <tr><td colSpan={6} className="muted">No hay documentos con esos criterios.</td></tr>}
              {docs.map((d) => {
                const emp = d.empresa as Empresa
                const cat = d.categoria as Categoria
                const dias = diasHasta(d.fechaCaducidad)
                return (
                  <tr key={d.id}>
                    <td><input type="checkbox" name="ids" value={d.id} aria-label={`Seleccionar ${d.titulo}`} /></td>
                    <td>
                      <Link href={`/portal/documentos/${d.id}`}>{d.titulo}</Link>
                      <span className="muted" style={{ display: 'block' }}>{[d.referencia, d.organismo].filter(Boolean).join(' · ')}</span>
                      {resolverGestion(emp?.gestion, cat?.gestion, d.gestion) === 'gestionado' && <span className="tag">Gestionado por CMC</span>}
                    </td>
                    {empresas.length > 1 && <td>{emp?.razonSocial}</td>}
                    <td>{cat?.nombre}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {d.fechaCaducidad ? fmt(d.fechaCaducidad) : 'Indefinido'}
                      {dias !== null && <span className="muted" style={{ display: 'block' }}>{dias < 0 ? `Caducó hace ${-dias} días` : `Faltan ${dias} días`}</span>}
                    </td>
                    <td><StatusBadge estado={d.estado as Estado} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </form>

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
