import Link from 'next/link'
import { claseFila } from '@/components/MarcaEstado'
import { resolverGestion, type Estado } from '@/lib/estado'
import { diasHasta, fmt } from '@/lib/payload'
import type { Categoria, Documento, Empresa } from '@/datos/tipos'

export function TablaDocumentos({ docs, empresa, vacio, conEmpresa }: { docs: Documento[]; empresa?: Empresa; vacio: string; conEmpresa?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Documento</th>
            {conEmpresa && <th>Empresa</th>}
            <th>Instalación</th>
            <th>Caducidad</th>
          </tr>
        </thead>
        <tbody>
          {docs.length === 0 && (<tr><td colSpan={conEmpresa ? 4 : 3} className="muted">{vacio}</td></tr>)}
          {docs.map((d) => {
            const dias = diasHasta(d.fechaCaducidad)
            const cat = typeof d.categoria === 'object' ? (d.categoria as Categoria) : null
            const emp = empresa ?? (typeof d.empresa === 'object' ? (d.empresa as Empresa) : undefined)
            const fila = claseFila(d.estado as Estado, d.estadoManual === 'naranja' && d.estado !== 'naranja')
            return (
              <tr key={d.id} className={fila.className}>
                <td>
                  <span className="sr-only">{fila.label}</span>
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
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
