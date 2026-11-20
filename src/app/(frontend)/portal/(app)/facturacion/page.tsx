import Link from 'next/link'
import { resolverGestion } from '@/lib/estado'
import { listarDocumentos } from '@/datos/consultas'
import type { Categoria, Documento, Empresa } from '@/datos/tipos'
import { contexto, fmt } from '@/lib/payload'

export const metadata = { title: 'Facturación' }

const clave = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

/** Lista de consulta de los clientes que CMC debe facturar en el mes. No se conecta a ningún programa de facturación. */
export default async function FacturacionPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams
  const { user, cmc } = await contexto('/portal/facturacion')
  const ahora = new Date()
  const pedido = /^(\d{4})-(\d{2})$/.exec(sp.mes ?? '')
  const anio = pedido ? Number(pedido[1]) : ahora.getFullYear()
  const mes = pedido ? Number(pedido[2]) : ahora.getMonth() + 1
  const inicio = new Date(anio, mes - 1, 1)
  const fin = new Date(anio, mes, 1)
  const etiqueta = inicio.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  const docs = await listarDocumentos(
    user,
    'AND ((fecha_aviso >= $1 AND fecha_aviso < $2) OR (fecha_caducidad >= $1 AND fecha_caducidad < $2))',
    [inicio.toISOString(), fin.toISOString()],
    5000,
  )

  const dentro = (fecha?: string | null) => {
    if (!fecha) return false
    const t = new Date(fecha).getTime()
    return t >= inicio.getTime() && t < fin.getTime()
  }
  const filas = docs
    .map((d) => {
      const empresa = d.empresa as Empresa
      const cat = d.categoria as Categoria
      if (!empresa?.activa || resolverGestion(empresa.gestion, cat?.gestion, d.gestion) !== 'gestionado') return null
      const porAviso = dentro(d.fechaAviso)
      const porCaducidad = dentro(d.fechaCaducidad)
      if (!porAviso && !porCaducidad) return null
      return { d, empresa, cat, porAviso, porCaducidad }
    })
    .filter((f) => f !== null)
    .sort((a, b) => a.empresa.razonSocial.localeCompare(b.empresa.razonSocial, 'es') || a.d.titulo.localeCompare(b.d.titulo, 'es'))

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{cmc ? 'CMC' : user.email}</p>
        <h1>{cmc ? `A facturar en ${etiqueta}` : `Facturación de ${etiqueta}`}</h1>
        <p className="muted">
          {cmc
            ? 'Documentos gestionados por CMC con un aviso o una caducidad en este mes. Los envíos que el cliente ha mandado y todavía no están publicados no entran. Es solo una consulta: no se conecta con ningún programa de facturación.'
            : 'Documentos que CMC gestiona y que tienen un aviso o una caducidad en este mes. No son los archivos que usted ha enviado.'}
        </p>
      </div>
      <nav className="row" aria-label="Mes">
        <Link className="btn btn--secondary btn--sm" href={`?mes=${clave(new Date(anio, mes - 2, 1))}`}>Mes anterior</Link>
        <Link className="btn btn--secondary btn--sm" href="/portal/facturacion">Mes actual</Link>
        <Link className="btn btn--secondary btn--sm" href={`?mes=${clave(fin)}`}>Mes siguiente</Link>
      </nav>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {cmc && <th>Cliente</th>}
              {cmc && <th>CIF</th>}
              <th>Documento</th>
              <th>Categoría</th>
              <th>En el mes</th>
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && <tr><td colSpan={cmc ? 5 : 3} className="muted">Este mes no hay documentos gestionados con aviso o caducidad.</td></tr>}
            {filas.map(({ d, empresa, cat, porAviso, porCaducidad }) => (
              <tr key={d.id}>
                {cmc && <td><Link href={`/portal?empresa=${empresa.id}`}>{empresa.razonSocial}</Link></td>}
                {cmc && <td>{empresa.cif}</td>}
                <td><Link href={`/portal/documentos/${d.id}`}>{d.titulo}</Link></td>
                <td>{cat?.nombre}</td>
                <td>
                  {porAviso && <span style={{ display: 'block' }}>Aviso {fmt(d.fechaAviso)}</span>}
                  {porCaducidad && <span style={{ display: 'block' }}>Caducidad {fmt(d.fechaCaducidad)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
