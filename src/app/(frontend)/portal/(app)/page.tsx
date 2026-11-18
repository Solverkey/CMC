import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { StatusBadge } from '@/components/StatusBadge'
import { TablaDocumentos } from '@/components/TablaDocumentos'
import { empresasDe } from '@/access'
import { peorEstado, type Estado } from '@/lib/estado'
import { conteoPorEmpresa } from '@/lib/estadisticas'
import { contexto, empresasDelUsuario, idDe } from '@/lib/payload'
import type { Documento, Empresa, User } from '@/payload-types'

export const metadata = { title: 'Panel' }

const PLAZOS = [30, 60, 90]
const VISIBLES: Estado[] = ['verde', 'amarillo', 'naranja', 'rojo', 'azul', 'negro']

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ empresa?: string; plazo?: string; filtro?: string; q?: string }> }) {
  const sp = await searchParams
  const { payload, user, cmc } = await contexto()
  const { empresas, empresa } = await empresasDelUsuario(user, sp.empresa)
  if (!empresa) return <p>No tiene ninguna empresa asignada. Contacte con CMC.</p>
  if (!sp.empresa && (cmc || empresas.length > 1)) return <Consolidado empresas={empresas} cmc={cmc} user={user} filtro={sp.filtro} q={sp.q} />

  const plazo = PLAZOS.includes(Number(sp.plazo)) ? Number(sp.plazo) : 60
  const limite = new Date()
  limite.setDate(limite.getDate() + plazo)

  // overrideAccess: false: el control de acceso por empresa se aplica siempre en el servidor.
  const [docs, categorias] = await Promise.all([
    payload.find({ collection: 'documentos', user, overrideAccess: false, depth: 1, limit: 5000, where: { empresa: { equals: empresa.id } }, sort: 'fechaCaducidad' }),
    payload.find({ collection: 'categorias', user, overrideAccess: false, depth: 0, limit: 500, where: { empresa: { equals: empresa.id }, archivada: { not_equals: true } }, sort: 'orden' }),
  ])

  const lista = docs.docs as Documento[]
  const cuenta = (e: Estado) => lista.filter((d) => d.estado === e).length
  const proximos = lista.filter((d) => d.estado !== 'azul' && d.estado !== 'negro' && (d.estado === 'rojo' || d.estado === 'amarillo' || d.estado === 'naranja' || (d.fechaCaducidad && new Date(d.fechaCaducidad) <= limite)))
  const qs = (p: number) => `?empresa=${empresa.id}&plazo=${p}`

  return (
    <>
      {(cmc || empresas.length > 1) && <Link href="/portal" className="small">← Todas las empresas</Link>}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          <p className="small muted">{empresa.razonSocial}</p>
          <h1>Estado de su documentación</h1>
        </div>
        <div className="row">
          <a href={`/api/inventario/${empresa.id}?formato=xlsx`} className="btn btn--secondary btn--sm"><Icon name="download" />Inventario Excel</a>
          <a href={`/api/inventario/${empresa.id}?formato=pdf`} className="btn btn--secondary btn--sm"><Icon name="download" />Inventario PDF</a>
          {cmc ? (
            <a href={`/admin/collections/documentos/create`} className="btn btn--primary"><Icon name="file" />Nuevo documento</a>
          ) : (
            <Link href={`/portal/enviar?empresa=${empresa.id}`} className="btn btn--primary"><Icon name="upload" />Enviar documento</Link>
          )}
        </div>
      </div>

      <section aria-label="Resumen por estado" className="kpis">
        {VISIBLES.map((e) => (
          <Link key={e} href={`/portal/documentos?empresa=${empresa.id}&estado=${e}`} className={`kpi kpi--${e}`} style={{ textDecoration: 'none' }}>
            <StatusBadge estado={e} />
            <b>{cuenta(e)}</b>
          </Link>
        ))}
      </section>

      <div className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
        <section className="stack" style={{ flex: '999 1 560px', minWidth: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Próximos vencimientos</h2>
            <nav aria-label="Plazo" className="row segmentado">
              {PLAZOS.map((p) => (
                <Link key={p} href={qs(p)} aria-current={p === plazo ? 'true' : undefined} className="btn btn--sm">{p} días</Link>
              ))}
            </nav>
          </div>
          <TablaDocumentos docs={proximos} empresa={empresa} vacio={`Nada vence en los próximos ${plazo} días.`} />
        </section>

        <aside className="card stack" style={{ flex: '1 1 300px', minWidth: 0, gap: 4 }}>
          <h2 style={{ fontSize: 22, lineHeight: '28px', marginBottom: 8 }}>Por categoría</h2>
          {categorias.docs.length === 0 && <p className="muted">Sin categorías.</p>}
          {categorias.docs.map((c) => {
            const deCat = lista.filter((d) => idDe(d.categoria) === String(c.id))
            const peor = peorEstado(deCat.map((d) => d.estado as Estado))
            return (
              <Link key={c.id} href={`/portal/documentos?empresa=${empresa.id}&categoria=${c.id}`} className="row" style={{ justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)', textDecoration: 'none', color: 'inherit' }}>
                <strong>{c.nombre}</strong>
                {deCat.length ? <StatusBadge estado={peor} count={deCat.filter((d) => d.estado === peor).length} /> : <span className="muted small">Vacía</span>}
              </Link>
            )
          })}
        </aside>
      </div>
    </>
  )
}

/** Vista consolidada (RF-15) y panel de CMC por empresa (RF-14). */
async function Consolidado({ empresas, cmc, user, filtro, q }: { empresas: Empresa[]; cmc: boolean; user: User; filtro?: string; q?: string }) {
  const { payload } = await contexto()
  const conteo = await conteoPorEmpresa(payload, cmc ? null : empresasDe(user))
  const [pendientes, abiertos] = cmc
    ? await Promise.all([
        payload.find({ collection: 'envios', where: { estado: { equals: 'pendiente' } }, limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { empresa: true } }),
        payload.find({ collection: 'hilos', where: { estado: { equals: 'abierto' } }, limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { empresa: true } }),
      ])
    : [null, null]
  const porEmpresa = (docs: { empresa?: unknown }[] | undefined, id: number) => docs?.filter((d) => idDe(d.empresa) === String(id)).length ?? 0

  const filas = empresas
    .map((e) => {
      const c = conteo[String(e.id)] ?? { verde: 0, amarillo: 0, naranja: 0, rojo: 0, negro: 0 }
      const peor = peorEstado(VISIBLES.filter((k) => c[k] > 0))
      return { e, c, peor, envios: porEmpresa(pendientes?.docs, e.id), hilos: porEmpresa(abiertos?.docs, e.id) }
    })
    .filter((f) => !q || f.e.razonSocial.toLowerCase().includes(q.toLowerCase()) || f.e.cif.toLowerCase().includes(q.toLowerCase()))
    .filter((f) => (filtro === 'atencion' ? f.c.negro + f.c.rojo + f.c.amarillo + f.c.naranja > 0 || f.envios > 0 : filtro === 'gestionado' ? f.e.gestion === 'gestionado' : true))
    .sort((a, b) => (filtro ? 0 : b.c.negro - a.c.negro || b.c.rojo - a.c.rojo || b.c.amarillo - a.c.amarillo))

  const total = (k: Estado) => filas.reduce((s, f) => s + f.c[k], 0)

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          <p className="small muted">{cmc ? 'CMC' : `${empresas.length} empresas`}</p>
          <h1>{cmc ? 'Panel de empresas' : 'Vista consolidada'}</h1>
        </div>
        {cmc && <a href="/admin/collections/empresas/create" className="btn btn--primary"><Icon name="building" />Alta de empresa</a>}
      </div>

      <section aria-label="Resumen" className="kpis">
        {VISIBLES.map((e) => (
          <Link key={e} href={`/portal/documentos?estado=${e}`} className={`kpi kpi--${e}`} style={{ textDecoration: 'none' }}>
            <StatusBadge estado={e} />
            <b>{total(e)}</b>
          </Link>
        ))}
      </section>

      <form className="row" role="search">
        <input className="input" name="q" defaultValue={q} placeholder="Buscar empresa o CIF" aria-label="Buscar empresa" style={{ flex: '1 1 240px' }} />
        <select className="input" name="filtro" defaultValue={filtro ?? ''} aria-label="Filtro">
          <option value="">Todas</option>
          <option value="atencion">Requieren atención</option>
          <option value="gestionado">Gestionadas por CMC</option>
        </select>
        <button className="btn btn--secondary">Filtrar</button>
      </form>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>Estado</th>
              {VISIBLES.map((e) => <th key={e}><span className={`status status--${e}`} style={{ padding: 0, background: 'none' }} /></th>)}
              {cmc && <th>Envíos</th>}
              {cmc && <th>Mensajes</th>}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={VISIBLES.length + (cmc ? 4 : 2)} className="muted">Ninguna empresa coincide.</td></tr>}
            {filas.map(({ e, c, peor, envios, hilos }) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/portal?empresa=${e.id}`}>{e.razonSocial}</Link>
                  <span className="muted" style={{ display: 'block' }}>{e.cif}{e.gestion === 'gestionado' ? ' · Gestionado por CMC' : ''}</span>
                </td>
                <td><StatusBadge estado={peor} /></td>
                {VISIBLES.map((k) => <td key={k}>{c[k] || <span className="muted">0</span>}</td>)}
                {cmc && <td>{envios ? <Link href={`/portal/enviar?empresa=${e.id}`}>{envios}</Link> : <span className="muted">0</span>}</td>}
                {cmc && <td>{hilos ? <Link href={`/portal/mensajes?empresa=${e.id}`}>{hilos}</Link> : <span className="muted">0</span>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
