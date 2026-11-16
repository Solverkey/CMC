import { notFound } from 'next/navigation'
import { leerConfiguracion } from '@/lib/configuracion'
import { almacenamiento } from '@/lib/estadisticas'
import { tamano } from '@/lib/subidas'
import { contexto } from '@/lib/payload'

export const metadata = { title: 'Almacenamiento' }

export default async function AlmacenamientoPage() {
  const { payload, req, cmc } = await contexto('/portal/almacenamiento')
  if (!cmc) notFound()
  const [uso, cfg, empresas] = await Promise.all([
    almacenamiento(payload),
    leerConfiguracion(payload, req),
    payload.find({ collection: 'empresas', limit: 0, pagination: false, depth: 0, overrideAccess: true, select: { razonSocial: true } }),
  ])
  const limite = cfg.limiteGB * 1024 ** 3
  const pct = limite ? Math.round((uso.total / limite) * 100) : 0
  const nombre = new Map(empresas.docs.map((e) => [String(e.id), e.razonSocial]))
  const filas = Object.entries(uso.porEmpresa).sort((a, b) => b[1] - a[1])

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">CMC</p>
        <h1>Almacenamiento</h1>
        <p className="muted">Espacio ocupado por los archivos y la base de datos. Se avisa a CMC por correo al superar el {cfg.avisoPorcentaje} % del límite contratado.</p>
      </div>
      <section className="card stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <strong>{tamano(uso.total)} de {cfg.limiteGB} GB</strong>
          <span className={`status status--${pct >= 100 ? 'rojo' : pct >= cfg.avisoPorcentaje ? 'naranja' : 'verde'}`}>{pct} %</span>
        </div>
        <div className="barra" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${Math.min(pct, 100)}%`, background: pct >= cfg.avisoPorcentaje ? 'var(--status-soon)' : 'var(--slate)' }} />
        </div>
        <dl className="dl">
          <div><dt>Archivos</dt><dd>{tamano(uso.ficheros)}</dd></div>
          <div><dt>Base de datos</dt><dd>{tamano(uso.bd)}</dd></div>
        </dl>
      </section>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Empresa</th><th>Espacio</th><th>% del total</th></tr></thead>
          <tbody>
            {filas.map(([id, bytes]) => (
              <tr key={id}>
                <td>{nombre.get(id) ?? (id === 'sin' ? 'Sin empresa (logotipos, etc.)' : `Empresa ${id}`)}</td>
                <td>{tamano(bytes)}</td>
                <td>{uso.ficheros ? Math.round((bytes / uso.ficheros) * 100) : 0} %</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
