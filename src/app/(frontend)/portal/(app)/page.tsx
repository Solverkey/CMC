import Link from 'next/link'
import { AltaEmpresa } from '@/components/AltaEmpresa'
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
  const proximos = lista.filter((d) => d.estado !== 'azul' && d.estado !== 'negro' && d.fechaCaducidad && new Date(d.fechaCaducidad) <= limite)
  const qs = (p: number) => `?empresa=${empresa.id}&plazo=${p}`

  return (
    <>
      {(cmc || empresas.length > 1) && <Link href="/portal" className="small">← Todas las empresas</Link>}
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
        <div className="stack" style={{ gap: 4 }}>
          <p className="small muted">{empresa.razonSocial}</p>
          <h1>Estado de su documentación</h1>
        </div>
        <div className="row">
          <a href={`/api/inventario/${empresa.id}?formato=xlsx`} className="btn btn--secondary btn--sm"><Icon name="download" />Inventario Excel</a>
          <a href={`/api/inventario/${empresa.id}?formato=pdf`} className="btn btn--secondary btn--sm"><Icon name="download" />Inventario PDF</a>
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

      <div className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
        <section className="stack" style={{ flex: '999 1 560px', minWidth: 0 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Próximos vencimientos</h2>
            <nav aria-label="Plazo" className="row segmentado">
              {PLAZOS.map((p) => (
                <Link key={p} href={qs(p)} aria-current={p === plazo ? 'true' : undefined} className="btn btn--sm">{p} días</Link>
              ))}
            </nav>
          </div>
          <TablaDocumentos docs={proximos} empresa={empresa} vacio={`Nada vence en los próximos ${plazo} días.`} />
        </section>

        <aside className="card stack" style={{ flex: '1 1 340px', minWidth: 0, gap: 12 }}>
          <h2 style={{ fontSize: 22, lineHeight: '28px', margin: 0 }}>Instalaciones y documentos</h2>
          {cmc && (
            <FormAccion accion={guardarAvisoEmpresa} className="stack" style={{ gap: 8 }}>
              <input type="hidden" name="empresa" value={empresa.id} />
              <div className="field">
                <label htmlFor="antelacion-empresa">Aviso estándar del cliente (meses)</label>
                <input className="input" id="antelacion-empresa" name="antelacionMeses" type="number" min={0} defaultValue={empresa.antelacionMeses ?? ''} placeholder={String(cfg.antelacionMeses)} />
                <span className="hint">Vacío = {cfg.antelacionMeses} meses de la plataforma. Cada documento puede cambiarlo.</span>
              </div>
              <button className="btn btn--secondary btn--sm" type="submit">Guardar estándar</button>
            </FormAccion>
          )}
          {categorias.length === 0 && <p className="muted">Sin instalaciones.</p>}
          {categorias.map((c) => {
            const deCat = lista.filter((d) => idDe(d.categoria) === String(c.id) && visibles.includes(d.estado as Estado))
            return (
              <div key={c.id} className="stack" style={{ gap: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                <Link href={`/portal/documentos?empresa=${empresa.id}&categoria=${c.id}`} style={{ fontWeight: 700, textDecoration: 'none' }}>{c.nombre}</Link>
                {cmc && (
                  <FormAccion accion={guardarAntelacionCategoria} className="row" style={{ gap: 8, alignItems: 'end' }}>
                    <input type="hidden" name="categoria" value={c.id} />
                    <div className="field" style={{ flex: '1 1 120px' }}>
                      <label className="small" htmlFor={`ant-${c.id}`}>Meses de esta instalación</label>
                      <input className="input" id={`ant-${c.id}`} name="antelacionMeses" type="number" min={0} defaultValue={c.antelacionMeses ?? ''} placeholder={String(empresa.antelacionMeses ?? cfg.antelacionMeses)} />
                    </div>
                    <button className="btn btn--secondary btn--sm" type="submit">Guardar</button>
                  </FormAccion>
                )}
                {deCat.length === 0 && <p className="muted small">Sin documentos.</p>}
                {deCat.map((d) => (
                  <Link key={d.id} href={`/portal/documentos/${d.id}`} className="row" style={{ justifyContent: 'space-between', gap: 8, textDecoration: 'none', color: 'inherit' }}>
                    <span>{d.titulo}</span>
                    <StatusBadge estado={d.estado as Estado} />
                  </Link>
                ))}
              </div>
            )
          })}
        </aside>
      </div>
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
