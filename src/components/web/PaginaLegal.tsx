import { CabeceraPagina } from './Bloques'
import { bloques, textoLegal, type PaginaLegal as Clave } from '@/lib/legal'
import { leerWeb } from '@/lib/web'

export async function PaginaLegal({ pagina, titulo }: { pagina: Clave; titulo: string }) {
  const web = await leerWeb()
  return (
    <>
      <CabeceraPagina antetitulo="Información legal" titulo={titulo} />
      <article className="section container legal">
        {bloques(textoLegal(pagina, web)).map((b, i) =>
          b.tipo === 'titulo' ? (
            <h2 key={i}>{b.texto}</h2>
          ) : (
            <p key={i}>
              {b.texto.split('\n').map((l, j, todas) => (
                <span key={j}>
                  {l}
                  {j < todas.length - 1 ? <br /> : null}
                </span>
              ))}
            </p>
          ),
        )}
      </article>
    </>
  )
}
