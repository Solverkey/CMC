import { EnviarForm } from '@/components/EnviarForm'
import { EmpresaSelector } from '@/components/EmpresaSelector'
import { StatusBadge } from '@/components/StatusBadge'
import { empresasDelUsuario, fmt, requireUser } from '@/lib/payload'

export const metadata = { title: 'Enviar a CMC' }

const ESTADO_ENVIO = { pendiente: 'naranja', publicado: 'verde', rechazado: 'rojo' } as const
const LABEL_ENVIO = { pendiente: 'Pendiente', publicado: 'Publicado', rechazado: 'Rechazado' } as const

export default async function EnviarPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const sp = await searchParams
  const { payload, user } = await requireUser()
  const { empresas, empresa } = await empresasDelUsuario(user, sp.empresa)
  if (!empresa) return <p>No tiene ninguna empresa asignada.</p>
  const envios = await payload.find({ collection: 'envios', user, overrideAccess: false, depth: 0, limit: 20, sort: '-createdAt', where: { empresa: { equals: empresa.id } } })

  return (
    <>
      <EmpresaSelector empresas={empresas.map((e) => ({ id: String(e.id), nombre: e.razonSocial }))} activa={String(empresa.id)} />
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{empresa.razonSocial}</p>
        <h1>Enviar documentos a CMC</h1>
        <p className="muted">CMC revisa cada envío, completa la categoría y las fechas, y lo publica en su portal.</p>
      </div>
      <section className="card"><EnviarForm empresaId={String(empresa.id)} /></section>
      <section className="stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Sus envíos</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Documento</th><th>Enviado</th><th>Estado</th></tr></thead>
            <tbody>
              {envios.docs.length === 0 && <tr><td colSpan={3} className="muted">Todavía no ha enviado ningún documento.</td></tr>}
              {envios.docs.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.titulo}</strong>{e.estado === 'rechazado' && e.motivoRechazo && <span className="muted" style={{ display: 'block' }}>Motivo: {e.motivoRechazo}</span>}</td>
                  <td>{fmt(e.createdAt)}</td>
                  <td><span className={`status status--${ESTADO_ENVIO[e.estado ?? 'pendiente']}`}>{LABEL_ENVIO[e.estado ?? 'pendiente']}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
void StatusBadge
