import Link from 'next/link'
import { Suspense } from 'react'
import { BotonZip, MarcarTodos } from '@/components/BotonZip'
import { EnviarCmc } from '@/components/EnviarCmc'
import { FiltrosDocumentos } from '@/components/FiltrosDocumentos'
import { Icon } from '@/components/Icon'
import { SubirDocumento } from '@/components/SubirDocumento'
import { ESTADOS, resolverGestion, type Estado } from '@/lib/estado'
import { plazo } from '@/lib/plazo'
import { categoriasDeEmpresa, listarEnvios } from '@/datos/consultas'
import type { Categoria, Documento, Empresa } from '@/datos/tipos'
import { contexto, diasHasta, empresasDelUsuario, fmt, fmtHora } from '@/lib/payload'
import { leerConfiguracion } from '@/lib/configuracion'
import { buscarDocumentos, contarPorEstado, ORDENES } from '@/servicios/documentos'

export const metadata = { title: 'Documentos' }

type SP = { subir?: string; q?: string; empresa?: string; categoria?: string; estado?: string | string[]; desde?: string; hasta?: string; pagina?: string; orden?: string }

/** Orden de los botones de estado: lo que pide atención primero. */
const CHIPS: Estado[] = ['rojo', 'negro', 'amarillo', 'naranja', 'verde', 'azul']

export default async function DocumentosPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const { user, req, cmc } = await contexto('/portal/documentos')
  const { empresas, empresa } = await empresasDelUsuario(user, sp.empresa)
  const estados = ([] as string[]).concat(sp.estado ?? []).filter((e): e is Estado => e in ESTADOS)
  const pagina = Math.max(Number(sp.pagina) || 1, 1)
  // Con una sola empresa no hace falta elegirla: el filtro de instalación, la exportación y la subida se ofrecen igual.
  const empresaFiltro = sp.empresa || (empresas.length === 1 ? String(empresas[0].id) : '')
  const empresaActiva = empresaFiltro ? (empresas.find((e) => String(e.id) === empresaFiltro) ?? empresa) : null
  const filtros = { q: sp.q, empresa: sp.empresa, categoria: sp.categoria, desde: sp.desde, hasta: sp.hasta }

  const [r, cuenta, categorias, envios, cfg] = await Promise.all([
    buscarDocumentos(req, { ...filtros, estados, limite: 50, pagina, orden: sp.orden }),
    contarPorEstado(req, filtros),
    empresaFiltro ? categoriasDeEmpresa(empresaFiltro, { archivadas: cmc }) : null,
    !cmc ? listarEnvios(user, `${sp.empresa ? 'AND empresa_id = $1 ' : ''}ORDER BY created_at DESC`, sp.empresa ? [Number(sp.empresa)] : [], 20) : null,
    leerConfiguracion(),
  ])
  const docs = r.docs as Documento[]
  const conEmpresa = empresas.length > 1 && !sp.empresa
  const total = Object.entries(cuenta).filter(([e]) => cmc || e !== 'azul').reduce((s, [, n]) => s + n, 0)
  const hayFiltros = Boolean(sp.q || sp.categoria || sp.desde || sp.hasta || estados.length)

  const enlace = (cambios: Record<string, string | null>) => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) for (const x of ([] as string[]).concat(v ?? [])) if (k !== 'pagina' && k !== 'subir' && !(k in cambios)) u.append(k, x)
    for (const [k, v] of Object.entries(cambios)) if (v) u.set(k, v)
    const qs = u.toString()
    return `/portal/documentos${qs ? `?${qs}` : ''}`
  }
  const mesesDe = (cat?: Categoria | null) => (typeof cat?.antelacionMeses === 'number' ? cat.antelacionMeses : typeof empresaActiva?.antelacionMeses === 'number' ? empresaActiva.antelacionMeses : cfg.antelacionMeses)

  return (
    <>
      <header className="cabecera-docs">
        <div className="stack" style={{ gap: 4 }}>
          <p className="small muted">{empresaActiva ? empresaActiva.razonSocial : cmc ? 'Todas las empresas' : 'Todas sus empresas'}</p>
          <h1>Documentos</h1>
          <p className="muted">
            {cmc
              ? 'Inventario de las empresas cliente, con su estado y caducidad.'
              : 'Su documentación con su estado y su caducidad. Lo urgente aparece primero.'}
          </p>
        </div>
        <div className="row">
          {empresaActiva && (
            <div className="row" style={{ gap: 6 }} aria-label="Exportar inventario">
              <a href={`/api/inventario/${empresaActiva.id}?formato=xlsx`} className="btn btn--secondary btn--sm"><Icon name="download" />Excel</a>
              <a href={`/api/inventario/${empresaActiva.id}?formato=pdf`} className="btn btn--secondary btn--sm"><Icon name="download" />PDF</a>
            </div>
          )}
          {!cmc && empresaActiva && (
            <EnviarCmc empresaId={String(empresaActiva.id)} empresaNombre={empresaActiva.razonSocial} categorias={(categorias ?? []).filter((c) => !c.archivada).map((c) => ({ id: String(c.id), nombre: c.nombre }))} abrirAlCargar={sp.subir === '1'} />
          )}
          {cmc && empresaActiva && (
            <SubirDocumento
              empresaId={String(empresaActiva.id)}
              categorias={(categorias ?? []).filter((c) => !c.archivada).map((c) => ({ id: String(c.id), nombre: c.nombre }))}
              meses={mesesDe(null)}
              abrirAlCargar={sp.subir === '1'}
            />
          )}
          {!empresaActiva && empresas.length > 1 && (
            <details className="menu-elegir">
              <summary className="btn btn--primary"><Icon name="upload" />{cmc ? 'Subir documento' : 'Enviar a CMC'}</summary>
              <div className="menu-elegir__lista" role="menu">
                <p className="small muted">¿De qué empresa?</p>
                {empresas.map((e) => (
                  <Link key={e.id} role="menuitem" href={enlace({ empresa: String(e.id), categoria: null, subir: '1' })}>{e.razonSocial}</Link>
                ))}
              </div>
            </details>
          )}
        </div>
      </header>

      <nav className="chips" aria-label="Filtrar por estado">
        <Link href={enlace({ estado: null })} className="chip" aria-current={estados.length === 0 ? 'true' : undefined} scroll={false}>
          Todos <b>{total}</b>
        </Link>
        {CHIPS.filter((e) => cmc || e !== 'azul').map((e) => {
          const n = cuenta[e] ?? 0
          if (!n && !estados.includes(e)) return null
          const activo = estados.length === 1 && estados[0] === e
          return (
            <Link key={e} href={enlace({ estado: activo ? null : e })} className={`chip chip--${e}`} aria-current={activo ? 'true' : undefined} scroll={false}>
              <span className="chip__punto" aria-hidden="true" />
              {ESTADOS[e].label} <b>{n}</b>
            </Link>
          )
        })}
      </nav>

      <Suspense>
        <FiltrosDocumentos
          empresas={empresas.map((e) => ({ id: String(e.id), nombre: e.razonSocial }))}
          categorias={categorias ? categorias.map((c) => ({ id: String(c.id), nombre: c.archivada ? `${c.nombre} (archivada)` : c.nombre })) : null}
          ordenes={Object.entries(ORDENES).map(([id, o]) => ({ id, texto: o.texto }))}
        />
      </Suspense>

      <form id="seleccion" className="stack" style={{ gap: 12 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <p className="small muted">
            {r.totalDocs === 0 ? 'Ningún documento' : `${r.totalDocs} ${r.totalDocs === 1 ? 'documento' : 'documentos'}`}
            {hayFiltros && <> · <Link href={enlace({ q: null, categoria: null, desde: null, hasta: null, estado: null })}>Quitar filtros</Link></>}
          </p>
        </div>
        <BotonZip formId="seleccion" />

        {docs.length === 0 ? (
          <div className="vacio card">
            <Icon name="search" size={28} />
            {hayFiltros ? (
              <>
                <p><strong>Ningún documento coincide con la búsqueda.</strong></p>
                <Link className="btn btn--secondary btn--sm" href={enlace({ q: null, categoria: null, desde: null, hasta: null, estado: null })}>Quitar filtros</Link>
              </>
            ) : (
              <p><strong>Todavía no hay documentos.</strong> {cmc ? 'Elija una empresa y suba el primero.' : 'Envíe el primero a CMC con el botón de arriba.'}</p>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table docs">
              <thead>
                <tr>
                  <th className="docs__marca"><MarcarTodos formId="seleccion" /></th>
                  <th>Documento</th>
                  <th>{conEmpresa ? 'Empresa · instalación' : 'Instalación'}</th>
                  <th>Estado</th>
                  <th>Caducidad</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => {
                  const emp = d.empresa as Empresa
                  const cat = d.categoria as Categoria
                  const estado = (d.estado ?? 'verde') as Estado
                  const condicionada = d.estadoManual === 'naranja' && estado !== 'naranja'
                  const p = plazo(estado === 'negro' || estado === 'azul' ? (d.fechaCaducidad ? diasHasta(d.fechaCaducidad) : null) : diasHasta(d.fechaCaducidad))
                  const gestionado = resolverGestion(emp?.gestion, cat?.gestion, d.gestion) === 'gestionado'
                  return (
                    <tr key={d.id} className={`docs__fila estado--${estado}`}>
                      <td className="docs__marca"><input type="checkbox" name="ids" value={d.id} aria-label={`Seleccionar ${d.titulo}`} /></td>
                      <td className="docs__doc">
                        <Link href={`/portal/documentos/${d.id}`} className="docs__titulo">{d.titulo}</Link>
                        <span className="docs__meta">
                          {[d.referencia, d.organismo].filter(Boolean).join(' · ')}
                          {gestionado && <span className="mini" title="CMC se encarga de la renovación"><Icon name="shield" size={12} />Gestiona CMC</span>}
                        </span>
                      </td>
                      <td className="docs__donde">
                        {conEmpresa && <span className="docs__empresa">{emp?.razonSocial}</span>}
                        <Link href={enlace({ empresa: String(emp?.id ?? ''), categoria: String(cat?.id ?? ''), pagina: null })} className="docs__instalacion">{cat?.nombre ?? '—'}</Link>
                      </td>
                      <td className="docs__estado">
                        <span className={`status status--${estado}`}>{ESTADOS[estado].label}</span>
                        {condicionada && <span className="status status--naranja">Condicionada</span>}
                      </td>
                      <td className="docs__cad">
                        <span className={`plazo plazo--${p.tono}`}>{estado === 'negro' ? 'Pendiente de legalizar' : estado === 'azul' ? 'Archivado' : p.texto}</span>
                        <span className="small muted">{d.fechaCaducidad ? fmt(d.fechaCaducidad) : 'Indefinido'}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </form>

      {r.totalPages > 1 && (
        <nav className="row" aria-label="Páginas" style={{ justifyContent: 'center' }}>
          {r.hasPrevPage && <Link className="btn btn--secondary btn--sm" href={enlace({ pagina: String(pagina - 1) })}>Anterior</Link>}
          <span className="small muted">Página {pagina} de {r.totalPages}</span>
          {r.hasNextPage && <Link className="btn btn--secondary btn--sm" href={enlace({ pagina: String(pagina + 1) })}>Siguiente</Link>}
        </nav>
      )}

      {!cmc && (
        <section className="stack" style={{ gap: 12 }}>
          <div className="stack" style={{ gap: 4 }}>
            <h2 style={{ fontSize: 22, lineHeight: '28px' }}>Sus envíos a CMC</h2>
            <p className="small muted">Archivos que ha enviado. Quedan pendientes de revisión hasta que CMC los publica; entonces pasan a la lista de documentos.</p>
          </div>
          {(envios?.length ?? 0) === 0 ? (
            <p className="small muted">Todavía no ha enviado ningún archivo.</p>
          ) : (
            <ul className="envios">
              {envios!.map((e) => {
                const emp = typeof e.empresa === 'object' ? e.empresa : empresas.find((x) => String(x.id) === String(e.empresa))
                const destinoId = typeof e.documentoDestino === 'number' ? e.documentoDestino : e.documentoDestino?.id
                const estado = e.estado === 'publicado' ? 'verde' : e.estado === 'rechazado' ? 'rojo' : 'amarillo'
                const etiqueta = e.estado === 'publicado' ? 'Publicado' : e.estado === 'rechazado' ? 'Rechazado' : 'Pendiente de revisión'
                return (
                  <li key={e.id} className="envio">
                    <Icon name="file" />
                    <div className="envio__cuerpo">
                      <strong>{e.titulo}</strong>
                      <span className="small muted">
                        {e.filename} · {fmtHora(e.createdAt)}
                        {empresas.length > 1 && emp ? ` · ${(emp as Empresa).razonSocial}` : ''}
                      </span>
                      {e.estado === 'rechazado' && e.motivoRechazo && <span className="small">Motivo: {e.motivoRechazo}</span>}
                    </div>
                    <span className={`status status--${estado}`}>{etiqueta}</span>
                    {e.estado === 'publicado' && destinoId && <Link href={`/portal/documentos/${destinoId}`} className="small">Ver documento</Link>}
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
