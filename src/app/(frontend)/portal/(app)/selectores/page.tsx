import { redirect } from 'next/navigation'
import { FormAccion } from '@/components/FormAccion'
import { crearSelector, quitarSelector } from '@/app/(frontend)/portal/acciones'
import { listarCatalogoActivo } from '@/lib/catalogo'
import { contexto } from '@/lib/payload'

export const metadata = { title: 'Selectores' }

const TIPOS = [
  { id: 'categoria', texto: 'Instalaciones' },
  { id: 'documento', texto: 'Documentos' },
  { id: 'relacion', texto: 'Relación del archivo' },
] as const

export default async function SelectoresPage() {
  const { cmc } = await contexto('/portal/selectores')
  if (!cmc) redirect('/portal')
  const lista = await listarCatalogoActivo()

  return (
    <>
      <div className="stack" style={{ gap: 4 }}>
        <h1>Selectores</h1>
        <p className="muted">Opciones que salen al escribir un nombre. Se pueden añadir y quitar. Quitar una opción no borra los documentos que ya la usan.</p>
      </div>
      {TIPOS.map((tipo) => {
        const opciones = lista.filter((o) => o.tipo === tipo.id)
        return (
          <section key={tipo.id} className="card stack" style={{ gap: 12 }}>
            <h2 style={{ fontSize: 22, lineHeight: '28px', margin: 0 }}>{tipo.texto}</h2>
            <FormAccion accion={crearSelector} className="row" style={{ gap: 8, alignItems: 'end' }}>
              <input type="hidden" name="tipo" value={tipo.id} />
              <div className="field" style={{ flex: '1 1 220px' }}>
                <label htmlFor={`nuevo-${tipo.id}`}>Nueva opción</label>
                <input className="input" id={`nuevo-${tipo.id}`} name="nombre" required />
              </div>
              <button className="btn btn--primary" type="submit">Añadir</button>
            </FormAccion>
            {opciones.length === 0 && <p className="muted">Todavía no hay opciones.</p>}
            <ul className="stack" style={{ listStyle: 'none', margin: 0, padding: 0, gap: 8 }}>
              {opciones.map((o) => (
                <li key={o.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span>{o.nombre}</span>
                  <FormAccion accion={quitarSelector}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className="btn btn--secondary btn--sm" type="submit">Quitar</button>
                  </FormAccion>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </>
  )
}
