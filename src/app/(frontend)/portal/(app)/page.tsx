import Link from 'next/link'
import { EmpresaSelector } from '@/components/EmpresaSelector'
import { Icon } from '@/components/Icon'
import { StatusBadge } from '@/components/StatusBadge'
import { diasHasta, empresasDelUsuario, fmt, requireUser } from '@/lib/payload'
import { peorEstado, resolverGestion, type Estado } from '@/lib/estado'

export const metadata = { title: 'Panel' }

const PLAZOS = [30, 60, 90]

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ empresa?: string; plazo?: string }> }) {
  const sp = await searchParams
  const { payload, user } = await requireUser()
  const { empresas, empresa } = await empresasDelUsuario(user, sp.empresa)
  if (!empresa) return <p>No tiene ninguna empresa asignada. Contacte con CMC.</p>

  const plazo = PLAZOS.includes(Number(sp.plazo)) ? Number(sp.plazo) : 60
  const limite = new Date(); limite.setDate(limite.getDate() + plazo)

  // overrideAccess: false → el control de acceso por empresa se aplica en el servidor (RNF aislamiento de datos).
  const [docs, categorias] = await Promise.all([
    payload.find({ collection: 'documentos', user, overrideAccess: false, depth: 1, limit: 1000, where: { empresa: { equals: empresa.id }, estado: { not_equals: 'negro' } }, sort: 'fechaCaducidad' }),
    payload.find({ collection: 'categorias', user, overrideAccess: false, depth: 0, limit: 200, where: { empresa: { equals: empresa.id }, archivada: { not_equals: true } }, sort: 'orden' }),
  ])

  const cuenta = (e: Estado) => docs.docs.filter((d) => d.estado === e).length
  const proximos = docs.docs.filter((d) => d.estado === 'rojo' || d.estado === 'amarillo' || (d.fechaCaducidad && new Date(d.fechaCaducidad) <= limite))
  const qs = (p: number) => `?empresa=${empresa.id}&plazo=${p}`

  return (
    <>
      <EmpresaSelector empresas={empresas.map((e) => ({ id: String(e.id), nombre: e.razonSocial }))} activa={String(empresa.id)} />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          <p className="small muted">{empresa.razonSocial}</p>
          <h1>Estado de su documentación</h1>
        </div>
        <Link href={`/portal/enviar?empresa=${empresa.id}`} className="btn btn--primary"><Icon name="upload" />Enviar documento</Link>
      </div>

      <section aria-label="Resumen por estado" className="kpis">
        {(['verde', 'amarillo', 'naranja', 'rojo'] as Estado[]).map((e) => (
          <div key={e} className="kpi"><StatusBadge estado={e} /><b>{cuenta(e)}</b></div>
        ))}
      </section>

      <div className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
        <section className="stack" style={{ flex: '999 1 560px', minWidth: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Próximos vencimientos</h2>
            <nav aria-label="Plazo" className="row" style={{ gap: 4, padding: 4, background: 'var(--surface-sunken)', borderRadius: 8 }}>
              {PLAZOS.map((p) => (
                <Link key={p} href={qs(p)} aria-current={p === plazo ? 'true' : undefined} className="btn btn--sm" style={p === plazo ? { background: 'var(--surface-raised)', color: 'var(--slate-deep)' } : { color: 'var(--ink-muted)' }}>{p} días</Link>
              ))}
            </nav>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Documento</th><th>Categoría</th><th>Caducidad</th><th>Estado</th></tr></thead>
              <tbody>
                {proximos.length === 0 && (<tr><td colSpan={4} className="muted">Nada vence en los próximos {plazo} días.</td></tr>)}
                {proximos.map((d) => {
                  const dias = diasHasta(d.fechaCaducidad)
                  const cat = typeof d.categoria === 'object' ? d.categoria : null
                  return (
                    <tr key={d.id}>
                      <td>
                        <Link href={`/portal/documentos/${d.id}`}>{d.titulo}</Link>
                        <span className="muted" style={{ display: 'block' }}>{[d.referencia, d.organismo].filter(Boolean).join(' · ')}</span>
                        {resolverGestion(empresa.gestion, cat?.gestion, d.gestion) === 'gestionado' && <span className="tag">Gestionado por CMC</span>}
                      </td>
                      <td>{cat?.nombre ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmt(d.fechaCaducidad)}{dias !== null && <span className="muted" style={{ display: 'block' }}>{dias < 0 ? `Caducó hace ${-dias} días` : `Faltan ${dias} días`}</span>}</td>
                      <td><StatusBadge estado={d.estado as Estado} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="card stack" style={{ flex: '1 1 300px', minWidth: 0, gap: 4 }}>
          <h2 style={{ fontSize: 22, lineHeight: '28px', marginBottom: 8 }}>Por categoría</h2>
          {categorias.docs.map((c) => {
            const deCat = docs.docs.filter((d) => (typeof d.categoria === 'object' ? d.categoria?.id : d.categoria) === c.id)
            const peor = peorEstado(deCat.map((d) => d.estado as Estado))
            return (
              <div key={c.id} className="row" style={{ justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <strong>{c.nombre}</strong>
                <StatusBadge estado={peor} count={deCat.filter((d) => d.estado === peor).length} />
              </div>
            )
          })}
        </aside>
      </div>
    </>
  )
}
