import { Enlace as Link } from '@/components/Enlace'
import { AltaEmpresa } from '@/components/AltaEmpresa'
import { AvisoCorreo } from '@/components/AvisoCorreo'
import { FormAccion } from '@/components/FormAccion'
import { Icon } from '@/components/Icon'
import { StatusBadge } from '@/components/StatusBadge'
import { EnviarCmc } from '@/components/EnviarCmc'
import { SubirDocumento } from '@/components/SubirDocumento'
import { TablaDocumentos } from '@/components/TablaDocumentos'
import { guardarAntelacionCategoria, guardarAvisoEmpresa } from '@/app/(frontend)/portal/acciones'
import { empresasDe } from '@/access'
import { peorEstado, type Estado } from '@/lib/estado'
import { conteoPorEmpresa } from '@/lib/estadisticas'
import { categoriasDeEmpresa, listarDocumentos } from '@/datos/consultas'
import type { Documento, Empresa, User } from '@/datos/tipos'
import { filas as consultar } from '@/lib/db'
import { contexto, empresasDelUsuario, idDe } from '@/lib/payload'
import { leerConfiguracion } from '@/lib/configuracion'

export const metadata = { title: 'Panel' }

const PLAZOS = [30, 60, 90]
const VISIBLES: Estado[] = ['verde', 'amarillo', 'naranja', 'rojo', 'azul', 'negro']

export default async function PanelPage({ searchParams }: { searchParams: Promise<{ empresa?: string; plazo?: string; filtro?: string; q?: string }> }) {
  const sp = await searchParams
  const { user, cmc } = await contexto('/portal')
  const { empresas, empresa } = await empresasDelUsuario(user, sp.empresa)
  if (!empresa) return <p>No tiene ninguna empresa asignada. Contacte con CMC.</p>
  if (!sp.empresa && (cmc || empresas.length > 1)) return <Consolidado empresas={empresas} cmc={cmc} user={user} filtro={sp.filtro} q={sp.q} />

  const plazo = PLAZOS.includes(Number(sp.plazo)) ? Number(sp.plazo) : 60
  const limite = new Date()
  limite.setDate(limite.getDate() + plazo)

  // overrideAccess: false: el control de acceso por empresa se aplica siempre en el servidor.
  const [lista, categorias, cfg] = await Promise.all([
    listarDocumentos(user, 'AND empresa_id = $1 ORDER BY fecha_caducidad', [empresa.id], 5000),
    categoriasDeEmpresa(empresa.id, { archivadas: false }),
    leerConfiguracion(),
  ])
  const visibles = cmc ? VISIBLES : VISIBLES.filter((e) => e !== 'azul')
  const cuenta = (e: Estado, de = lista) => de.filter((d) => d.estado === e).length
  // Lo vencido y lo que vence en el plazo, de lo más urgente a lo menos.
  const proximos = lista.filter((d) => d.estado !== 'azul' && d.estado !== 'negro' && d.fechaCaducidad && new Date(d.fechaCaducidad) <= limite)
  const qs = (p: number) => `?empresa=${empresa.id}&plazo=${p}`
  const [envios, hilos] = cmc
    ? await Promise.all([
        consultar<{ n: number }>(`SELECT COUNT(*) AS n FROM envios WHERE estado = 'pendiente' AND empresa_id = $1`, [empresa.id]),
        consultar<{ n: number }>(`SELECT COUNT(*) AS n FROM hilos WHERE estado = 'abierto' AND empresa_id = $1`, [empresa.id]),
      ]).then(([a, b]) => [Number(a[0]?.n ?? 0), Number(b[0]?.n ?? 0)])
    : [0, 0]
  const tecnico = empresa.tecnico && typeof empresa.tecnico === 'object' ? (empresa.tecnico as User).nombre : null

  return (
    <>
      {cmc && <AvisoCorreo />}
      {(cmc || empresas.length > 1) && <Link href="/portal" className="small">← Todas las empresas</Link>}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          {cmc ? (
            <>
              <p className="small muted">CIF {empresa.cif}{empresa.sector ? ` · ${empresa.sector}` : ''}{tecnico ? ` · Técnico: ${tecnico}` : ''}</p>
              <h1>{empresa.razonSocial}</h1>
            </>
          ) : (
            <>
              <p className="small muted">{empresa.razonSocial}</p>
              <h1>Estado de su documentación</h1>
            </>
          )}
          {cmc && (
            <nav className="row small" style={{ gap: 16 }} aria-label="Accesos de la empresa">
              <Link href={`/portal/documentos?empresa=${empresa.id}`}>{lista.length} documentos</Link>
              <Link href={`/portal/enviar?empresa=${empresa.id}`}>{envios} {envios === 1 ? 'envío pendiente' : 'envíos pendientes'}</Link>
              <Link href={`/portal/mensajes?empresa=${empresa.id}`}>{hilos} {hilos === 1 ? 'conversación abierta' : 'conversaciones abiertas'}</Link>
              <Link href={`/portal/usuarios?empresa=${empresa.id}`}>Usuarios</Link>
            </nav>
          )}
        </div>
        <div className="row">
          <a href={`/api/inventario/${empresa.id}?formato=xlsx`} className="btn btn--secondary btn--sm"><Icon name="download" />Excel</a>
          <a href={`/api/inventario/${empresa.id}?formato=pdf`} className="btn btn--secondary btn--sm"><Icon name="download" />PDF</a>
          {cmc ? (
            <SubirDocumento
              empresaId={String(empresa.id)}
              meses={empresa.antelacionMeses ?? cfg.antelacionMeses}
              categorias={categorias.map((c) => ({ id: String(c.id), nombre: c.nombre }))}
              documentos={lista.map((d) => ({ id: String(d.id), titulo: d.titulo }))}
            />
          ) : (
            <EnviarCmc empresaId={String(empresa.id)} empresaNombre={empresa.razonSocial} categorias={categorias.map((c) => ({ id: String(c.id), nombre: c.nombre }))} />
          )}
        </div>
      </div>

      <section aria-label="Resumen por estado" className="kpis">
        {visibles.map((e) => (
          <Link key={e} href={`/portal/documentos?empresa=${empresa.id}&estado=${e}`} className={`kpi kpi--${e}`} style={{ textDecoration: 'none' }}>
            <StatusBadge estado={e} />
            <b>{cuenta(e)}</b>
          </Link>
        ))}
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="ficha__h2">Vencido y próximos vencimientos</h2>
          <nav aria-label="Plazo" className="row segmentado">
            {PLAZOS.map((p) => (
              <Link key={p} href={qs(p)} aria-current={p === plazo ? 'true' : undefined} className="btn btn--sm">{p} días</Link>
            ))}
          </nav>
        </div>
        <TablaDocumentos docs={proximos} empresa={empresa} vacio={`Nada caducado ni que venza en los próximos ${plazo} días.`} />
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="ficha__h2">Instalaciones</h2>
          {cmc && (
            <details className="ajustes">
              <summary className="btn btn--ghost btn--sm"><Icon name="settings" />Aviso estándar del cliente: {empresa.antelacionMeses ?? cfg.antelacionMeses} meses</summary>
              <FormAccion accion={guardarAvisoEmpresa} className="ajustes__caja stack" style={{ gap: 8 }}>
                <input type="hidden" name="empresa" value={empresa.id} />
                <div className="field">
                  <label htmlFor="antelacion-empresa">Meses de antelación del primer aviso</label>
                  <input className="input" id="antelacion-empresa" name="antelacionMeses" type="number" min={0} defaultValue={empresa.antelacionMeses ?? ''} placeholder={String(cfg.antelacionMeses)} />
                  <span className="hint">Vacío = {cfg.antelacionMeses} meses de la plataforma. Cada instalación y documento puede cambiarlo.</span>
                </div>
                <button className="btn btn--secondary btn--sm" type="submit">Guardar</button>
              </FormAccion>
            </details>
          )}
        </div>
        {categorias.length === 0 && <p className="vacio card small">Esta empresa todavía no tiene instalaciones.</p>}
        <ul className="instalaciones">
          {categorias.map((c) => {
            const deCat = lista.filter((d) => idDe(d.categoria) === String(c.id) && visibles.includes(d.estado as Estado))
            const colores = visibles.filter((e) => cuenta(e, deCat) > 0)
            const peor = deCat.length ? peorEstado(colores) : null
            return (
              <li key={c.id} className={`card instalacion${peor ? ` estado--${peor}` : ''}`}>
                <div className="stack" style={{ gap: 4 }}>
                  <Link href={`/portal/documentos?empresa=${empresa.id}&categoria=${c.id}`} className="instalacion__nombre">{c.nombre}</Link>
                  {c.descripcion && <span className="small muted">{c.descripcion}</span>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {colores.map((e) => <StatusBadge key={e} estado={e} count={cuenta(e, deCat)} />)}
                  {deCat.length === 0 && <span className="small muted">Sin documentos</span>}
                </div>
                <div className="instalacion__pie small muted">
                  <span>{deCat.length} {deCat.length === 1 ? 'documento' : 'documentos'}</span>
                  {c.gestion === 'gestionado' && <span className="mini"><Icon name="shield" size={12} />Gestiona CMC</span>}
                  {cmc && (
                    <details className="ajustes">
                      <summary className="enlace small">Aviso: {c.antelacionMeses ?? empresa.antelacionMeses ?? cfg.antelacionMeses} meses</summary>
                      <FormAccion accion={guardarAntelacionCategoria} className="ajustes__caja row" style={{ gap: 8, alignItems: 'end' }}>
                        <input type="hidden" name="categoria" value={c.id} />
                        <div className="field" style={{ flex: '1 1 120px' }}>
                          <label className="small" htmlFor={`ant-${c.id}`}>Meses de esta instalación</label>
                          <input className="input" id={`ant-${c.id}`} name="antelacionMeses" type="number" min={0} defaultValue={c.antelacionMeses ?? ''} placeholder={String(empresa.antelacionMeses ?? cfg.antelacionMeses)} />
                        </div>
                        <button className="btn btn--secondary btn--sm" type="submit">Guardar</button>
                      </FormAccion>
                    </details>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

/** Vista consolidada (RF-15) y panel de CMC por empresa (RF-14). */
async function Consolidado({ empresas, cmc, user, filtro, q }: { empresas: Empresa[]; cmc: boolean; user: User; filtro?: string; q?: string }) {
  const conteo = await conteoPorEmpresa(cmc ? null : empresasDe(user))
  const visibles = cmc ? VISIBLES : VISIBLES.filter((e) => e !== 'azul')
  const [pendientes, abiertos] = cmc
    ? await Promise.all([
        consultar<{ empresa: number; n: number }>(`SELECT empresa_id AS empresa, COUNT(*) AS n FROM envios WHERE estado = 'pendiente' GROUP BY empresa_id`),
        consultar<{ empresa: number; n: number }>(`SELECT empresa_id AS empresa, COUNT(*) AS n FROM hilos WHERE estado = 'abierto' GROUP BY empresa_id`),
      ])
    : [[], []]
  const porEmpresa = (docs: { empresa: number; n: number }[], id: number) => Number(docs.find((d) => String(d.empresa) === String(id))?.n ?? 0)

  const filas = empresas
    .map((e) => {
      const c = conteo[String(e.id)] ?? { verde: 0, amarillo: 0, naranja: 0, rojo: 0, azul: 0, negro: 0 }
      const peor = peorEstado(VISIBLES.filter((k) => c[k] > 0))
      return { e, c, peor, envios: porEmpresa(pendientes, e.id), hilos: porEmpresa(abiertos, e.id) }
    })
    .filter((f) => !q || f.e.razonSocial.toLowerCase().includes(q.toLowerCase()) || f.e.cif.toLowerCase().includes(q.toLowerCase()))
    .filter((f) => (filtro === 'atencion' ? f.c.negro + f.c.rojo + f.c.amarillo + f.c.naranja > 0 || f.envios > 0 : filtro === 'gestionado' ? f.e.gestion === 'gestionado' : true))
    .sort((a, b) => (filtro ? 0 : b.c.negro - a.c.negro || b.c.rojo - a.c.rojo || b.c.amarillo - a.c.amarillo))

  const total = (k: Estado) => filas.reduce((s, f) => s + f.c[k], 0)

  return (
    <>
      {cmc && <AvisoCorreo />}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          <p className="small muted">{cmc ? 'CMC' : `${empresas.length} empresas`}</p>
          <h1>{cmc ? 'Panel de empresas' : 'Vista consolidada'}</h1>
        </div>
        {cmc && <AltaEmpresa />}
      </div>

      <section aria-label="Resumen" className="kpis">
        {visibles.map((e) => (
          <Link key={e} href={`/portal/documentos?estado=${e}`} className={`kpi kpi--${e}`} style={{ textDecoration: 'none' }}>
            <StatusBadge estado={e} />
            <b>{total(e)}</b>
          </Link>
        ))}
      </section>

      <form className="row" role="search">
        <input className="input" name="q" defaultValue={q} placeholder="Buscar empresa o CIF" aria-label="Buscar empresa" style={{ flex: '1 1 240px' }} />
        <select className="input" name="filtro" defaultValue={filtro ?? ''} aria-label="Filtro">
          <option value="">Todas</option>
          <option value="atencion">Requieren atención</option>
          <option value="gestionado">Gestionadas por CMC</option>
        </select>
        <button className="btn btn--secondary">Filtrar</button>
      </form>

      {filas.length === 0 && <p className="muted">Ninguna empresa coincide.</p>}
      <ul className="empresas">
        {filas.map(({ e, c, peor, envios, hilos }) => {
          const tecnico = e.tecnico && typeof e.tecnico === 'object' ? e.tecnico.nombre : null
          const datos: [string, string][] = [
            ['CIF', e.cif],
            ...(e.sector ? [['Sector', e.sector] as [string, string]] : []),
            ...(e.direccion ? [['Dirección', e.direccion] as [string, string]] : []),
            ...(e.contacto ? [['Contacto', e.contacto] as [string, string]] : []),
            ['Gestión', e.gestion === 'gestionado' ? 'Gestionado por CMC' : 'No gestionado'],
          ]
          const colores = visibles.filter((k) => c[k] > 0)
          return (
            <li key={e.id} className="card empresa">
              <Link href={`/portal?empresa=${e.id}`} className="empresa__titulo">{e.razonSocial}</Link>
              <StatusBadge estado={peor} />
              <dl>
                {datos.map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
              <div className="empresa__bajo">
                {tecnico && (
                  <dl>
                    <div><dt>Técnico</dt><dd>{tecnico}</dd></div>
                  </dl>
                )}
                {colores.length > 0 && (
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {colores.map((k) => <StatusBadge key={k} estado={k} count={c[k]} />)}
                  </div>
                )}
                {cmc && (
                  <div className="empresa__pie">
                    <Link href={`/portal/enviar?empresa=${e.id}`}>{envios} envíos</Link>
                    <Link href={`/portal/mensajes?empresa=${e.id}`}>{hilos} mensajes</Link>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
