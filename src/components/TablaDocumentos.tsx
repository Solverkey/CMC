import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { ESTADOS, resolverGestion, type Estado } from '@/lib/estado'
import { plazo } from '@/lib/plazo'
import { diasHasta, fmt } from '@/lib/payload'
import type { Categoria, Documento, Empresa } from '@/datos/tipos'

/** Tabla compacta de documentos con el mismo aspecto que la lista de Documentos (franja de color, estado y plazo). */
export function TablaDocumentos({ docs, empresa, vacio, conEmpresa }: { docs: Documento[]; empresa?: Empresa; vacio: string; conEmpresa?: boolean }) {
  if (docs.length === 0) return <p className="vacio card small">{vacio}</p>
  return (
    <div className="table-wrap">
      <table className="table docs">
        <thead>
          <tr>
            <th>Documento</th>
            <th>{conEmpresa ? 'Empresa · instalación' : 'Instalación'}</th>
            <th>Estado</th>
            <th>Caducidad</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => {
            const cat = typeof d.categoria === 'object' ? (d.categoria as Categoria) : null
            const emp = empresa ?? (typeof d.empresa === 'object' ? (d.empresa as Empresa) : undefined)
            const estado = (d.estado ?? 'verde') as Estado
            const p = plazo(diasHasta(d.fechaCaducidad))
            return (
              <tr key={d.id} className={`docs__fila estado--${estado}`}>
                <td className="docs__doc">
                  <Link href={`/portal/documentos/${d.id}`} className="docs__titulo">{d.titulo}</Link>
                  <span className="docs__meta">
                    {[d.referencia, d.organismo].filter(Boolean).join(' · ')}
                    {resolverGestion(emp?.gestion, cat?.gestion, d.gestion) === 'gestionado' && <span className="mini"><Icon name="shield" size={12} />Gestiona CMC</span>}
                  </span>
                </td>
                <td className="docs__donde">
                  {conEmpresa && <span className="docs__empresa">{emp?.razonSocial}</span>}
                  {cat?.nombre ?? '—'}
                </td>
                <td className="docs__estado"><span className={`status status--${estado}`}>{ESTADOS[estado].label}</span></td>
                <td className="docs__cad">
                  <span className={`plazo plazo--${p.tono}`}>{p.texto}</span>
                  <span className="small muted">{d.fechaCaducidad ? fmt(d.fechaCaducidad) : 'Indefinido'}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
