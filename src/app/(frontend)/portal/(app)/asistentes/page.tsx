import { nuevaClave, revocarClave } from '../../acciones'
import { FormAccion } from '@/components/FormAccion'
import { urlServidor } from '@/lib/configuracion'
import { contexto, fmtHora } from '@/lib/payload'
import { clavesDe } from '@/mcp/claves'

export const metadata = { title: 'Asistentes de IA' }

export default async function AsistentesPage() {
  const { user } = await contexto('/portal/asistentes')
  const claves = (await clavesDe(user.id, false)).map((c) => ({
    id: c.id,
    label: c.label,
    origen: c.origen,
    createdAt: (c as { created_at?: string }).created_at,
    ultimoUso: c.ultimo_uso,
    caduca: c.caduca,
    renovacionCaduca: c.renovacion_caduca,
  }))
  const url = `${urlServidor()}/api/mcp`

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <p className="small muted">Conexión con asistentes de IA (Claude, ChatGPT, Cursor…)</p>
        <h1>Asistentes de IA</h1>
        <p className="muted">
          Conecte su asistente de IA al portal para consultar documentos, vencimientos y avisos, enviar documentos a CMC o escribir mensajes conversando.
          El asistente actúa siempre con sus permisos: solo ve sus empresas, y las acciones importantes le pedirán confirmación. Todo queda en el registro de actividad.
        </p>
      </div>

      <section className="card stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Cómo conectarlo</h2>
        <p>Añada en su asistente un conector o servidor MCP con esta dirección. Le pedirá entrar en el portal y autorizar el acceso:</p>
        <code className="clave">{url}</code>
        <p className="small muted">
          Si su asistente no admite el inicio de sesión (OAuth), cree abajo una clave y configúrela como cabecera <code>Authorization: Bearer &lt;clave&gt;</code>.
        </p>
      </section>

      <section className="card stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Crear una clave manual</h2>
        <FormAccion accion={nuevaClave} className="stack">
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: '2 1 240px' }}><label htmlFor="nombre">Nombre</label><input id="nombre" name="nombre" placeholder="Ej.: Claude en mi portátil" required /></div>
            <div className="field">
              <label htmlFor="dias">Validez</label>
              <select id="dias" name="dias" defaultValue="90">
                <option value="30">30 días</option>
                <option value="90">90 días</option>
                <option value="365">1 año</option>
              </select>
            </div>
            <button className="btn btn--primary">Crear clave</button>
          </div>
        </FormAccion>
      </section>

      <section className="stack">
        <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Accesos activos</h2>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Asistente</th><th>Tipo</th><th>Creado</th><th>Último uso</th><th>Caduca</th><th /></tr></thead>
            <tbody>
              {claves.length === 0 && <tr><td colSpan={6} className="muted">Ningún asistente conectado.</td></tr>}
              {claves.map((c) => {
                const d = c as typeof c & { origen?: string; caduca?: string; renovacionCaduca?: string; ultimoUso?: string; label?: string }
                return (
                  <tr key={c.id}>
                    <td><strong>{d.label ?? 'Asistente'}</strong></td>
                    <td>{d.origen === 'oauth' ? 'Autorizado (OAuth)' : 'Clave manual'}</td>
                    <td>{fmtHora(c.createdAt)}</td>
                    <td>{fmtHora(d.ultimoUso)}</td>
                    <td>{fmtHora(d.origen === 'oauth' ? d.renovacionCaduca : d.caduca)}</td>
                    <td>
                      <FormAccion accion={revocarClave} confirmar="¿Revocar este acceso? El asistente dejará de poder usar el portal.">
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn btn--ghost btn--sm error">Revocar</button>
                      </FormAccion>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
