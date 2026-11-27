import Link from 'next/link'
import { AvisoCorreo } from '@/components/AvisoCorreo'
import { EmpresaSelector } from '@/components/EmpresaSelector'
import { contexto, empresasDelUsuario, fmt, fmtHora } from '@/lib/payload'
import { centroAvisos } from '@/servicios/avisos'

export const metadata = { title: 'Avisos' }

const TIPOS: Record<string, string> = {
  proxima: 'Caducidad próxima',
  recordatorio: 'Recordatorio antes de caducar',
  caducado: 'Documento caducado',
  recordatorio_caducado: 'Recordatorio de documento caducado',
}
const ESTADO_CORREO: Record<string, string> = { pendiente: 'naranja', enviado: 'verde', entregado: 'verde', abierto: 'verde', rebotado: 'rojo', error: 'rojo' }

const ETIQUETA_CORREO: Record<string, string> = {
  pendiente: 'Pendiente de envío',
  enviado: 'Enviado',
  entregado: 'Entregado',
  abierto: 'Abierto',
  rebotado: 'Rebotado',
  error: 'No enviado',
}

export default async function AvisosPage({ searchParams }: { searchParams: Promise<{ empresa?: string }> }) {
  const sp = await searchParams
  const { user, req, cmc } = await contexto('/portal/avisos')
  const { empresas, empresa } = await empresasDelUsuario(user, sp.empresa)
  if (!empresa) return <p>No tiene ninguna empresa asignada.</p>
  const r = await centroAvisos(req, empresa.id)

  return (
    <>
      {cmc && <AvisoCorreo />}
      <EmpresaSelector empresas={empresas.map((e) => ({ id: String(e.id), nombre: e.razonSocial }))} activa={String(empresa.id)} />
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">{empresa.razonSocial}</p>
        <h1>Centro de avisos</h1>
        <p className="muted">Los avisos por correo que se enviarán en los próximos meses y los que ya se han enviado, con su estado de entrega.</p>
      </div>

      <section className="stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Próximos avisos</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Aviso</th><th>Documento</th><th>Modalidad</th></tr></thead>
            <tbody>
              {r.proximos.length === 0 && <tr><td colSpan={4} className="muted">No hay avisos programados en los próximos 4 meses.</td></tr>}
              {r.proximos.map((p, i) => (
                <tr key={i}>
                  <td>{fmt(p.fecha)}</td>
                  <td>{TIPOS[p.tipo] ?? p.tipo}</td>
                  <td><Link href={`/portal/documentos/${p.documento.id}`}>{p.documento.titulo}</Link></td>
                  <td>{p.gestionado ? <span className="tag">Gestionado por CMC</span> : 'No gestionado'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Correos enviados</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Fecha</th><th>Asunto</th><th>Para</th><th>Estado</th></tr></thead>
            <tbody>
              {r.enviados.length === 0 && <tr><td colSpan={4} className="muted">Todavía no se ha enviado ningún aviso.</td></tr>}
              {r.enviados.map((c) => (
                <tr key={c.id}>
                  <td>{fmtHora(c.createdAt)}</td>
                  <td>{c.asunto}{cmc && c.destinatario === 'cmc' && <span className="tag" style={{ marginLeft: 6 }}>Interno</span>}</td>
                  <td>{c.para}</td>
                  <td><span title={c.error ?? undefined} className={`status status--${ESTADO_CORREO[c.estado ?? 'pendiente'] ?? 'naranja'}`}>{ETIQUETA_CORREO[c.estado ?? 'pendiente'] ?? c.estado}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
