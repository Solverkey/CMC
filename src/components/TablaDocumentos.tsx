import Link from 'next/link'
import { StatusBadge } from '@/components/StatusBadge'
import { resolverGestion, type Estado } from '@/lib/estado'
import { diasHasta, fmt } from '@/lib/payload'
import type { Categoria, Documento, Empresa } from '@/payload-types'

export function TablaDocumentos({ docs, empresa, vacio, conEmpresa }: { docs: Documento[]; empresa?: Empresa; vacio: string; conEmpresa?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Documento</th>
            {conEmpresa && <th>Empresa</th>}
            <th>Categoría</th>
            <th>Caducidad</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 && (<tr><td colSpan={conEmpresa ? 5 : 4} className="muted">{vacio}</td></tr>)}
          {docs.map((d) => {
            const dias = diasHasta(d.fechaCaducidad)
            const cat = typeof d.categoria === 'object' ? (d.categoria as Categoria) : null
            const emp = empresa ?? (typeof d.empresa === 'object' ? (d.empresa as Empresa) : undefined)
            return (
              <tr key={d.id}>
                <td>
                  <Link href={`/portal/documentos/${d.id}`}>{d.titulo}</Link>
                  <span className="muted" style={{ display: 'block' }}>{[d.referencia, d.organismo].filter(Boolean).join(' · ')}</span>
                  {resolverGestion(emp?.gestion, cat?.gestion, d.gestion) === 'gestionado' && <span className="tag">Gestionado por CMC</span>}
                </td>
                {conEmpresa && <td>{emp?.razonSocial}</td>}
                <td>{cat?.nombre ?? '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {d.fechaCaducidad ? fmt(d.fechaCaducidad) : 'Indefinido'}
                  {dias !== null && <span className="muted" style={{ display: 'block' }}>{dias < 0 ? `Caducó hace ${-dias} días` : `Faltan ${dias} días`}</span>}
                </td>
                <td>
                  <StatusBadge estado={d.estado as Estado} />
                  {d.estadoManual === 'naranja' && d.estado !== 'naranja' && <span style={{ display: 'block', marginTop: 4 }}><StatusBadge estado="naranja" /></span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
