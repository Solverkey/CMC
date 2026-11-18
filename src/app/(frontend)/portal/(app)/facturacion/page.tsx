import Link from 'next/link'
import { resolverGestion } from '@/lib/estado'
import { contexto } from '@/lib/payload'
import type { Categoria, Documento, Empresa } from '@/payload-types'

export const metadata = { title: 'Facturación' }

const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Lista de consulta de los clientes que CMC debe facturar en el mes. No se conecta a ningún programa de facturación. */
export default async function FacturacionPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams
  const { payload, user, cmc } = await contexto('/portal/facturacion')
  const ahora = new Date()
  const pedido = /^(\d{4})-(\d{2})$/.exec(sp.mes ?? '')
  const anio = pedido ? Number(pedido[1]) : ahora.getFullYear()
  const mes = pedido ? Number(pedido[2]) : ahora.getMonth() + 1
  const inicio = new Date(anio, mes - 1, 1)
  const fin = new Date(anio, mes, 1)
  const etiqueta = inicio.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const docs = await payload.find({
    collection: 'documentos',
    user,
    overrideAccess: false,
    depth: 1,
    limit: 5000,
    where: {
      or: [
        { and: [{ fechaAviso: { greater_than_equal: inicio.toISOString() } }, { fechaAviso: { less_than: fin.toISOString() } }] },
        { and: [{ fechaCaducidad: { greater_than_equal: inicio.toISOString() } }, { fechaCaducidad: { less_than: fin.toISOString() } }] },
      ],
    },
  })

  const porEmpresa = new Map<number, { empresa: Empresa; documentos: string[] }>()
  for (const d of docs.docs as Documento[]) {
    const empresa = d.empresa as Empresa
    const cat = d.categoria as Categoria
    if (!empresa?.activa || resolverGestion(empresa.gestion, cat?.gestion, d.gestion) !== 'gestionado') continue
    const fila = porEmpresa.get(empresa.id) ?? { empresa, documentos: [] }
    fila.documentos.push(d.titulo)
    porEmpresa.set(empresa.id, fila)
  }
  const filas = [...porEmpresa.values()].sort((a, b) => a.empresa.razonSocial.localeCompare(b.empresa.razonSocial, 'es'))

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{cmc ? 'CMC' : user.email}</p>
        <h1>A facturar en {etiqueta}</h1>
        <p className="muted">Clientes con documentación gestionada por CMC que tiene un aviso o una caducidad en este mes. Es solo una consulta: no se conecta con ningún programa de facturación.</p>
      </div>
      <nav className="row" aria-label="Mes">
        <Link className="btn btn--secondary btn--sm" href={`?mes=${clave(new Date(anio, mes - 2, 1))}`}>Mes anterior</Link>
        <Link className="btn btn--secondary btn--sm" href="/portal/facturacion">Mes actual</Link>
        <Link className="btn btn--secondary btn--sm" href={`?mes=${clave(fin)}`}>Mes siguiente</Link>
      </nav>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Cliente</th><th>CIF</th><th>Documentos del mes</th></tr></thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={3} className="muted">Este mes no hay clientes a facturar.</td></tr>}
            {filas.map(({ empresa, documentos }) => (
              <tr key={empresa.id}>
                <td><Link href={`/portal?empresa=${empresa.id}`}>{empresa.razonSocial}</Link></td>
                <td>{empresa.cif}</td>
                <td>{documentos.join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
