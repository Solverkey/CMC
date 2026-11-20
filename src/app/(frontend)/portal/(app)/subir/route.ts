import { NextResponse } from 'next/server'
import { actualizarDocumento, crearArchivo, crearDocumento } from '@/datos/operaciones'
import { restarMeses } from '@/lib/estado'
import { contexto } from '@/lib/payload'

const fecha = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? '').trim()
  return v || undefined
}

/** CMC sube el archivo y con él entra el documento. No se crea un documento vacío. */
export async function POST(request: Request) {
  const { req, cmc } = await contexto('/portal')
  if (!cmc) return NextResponse.json({ error: 'Solo CMC puede subir documentos.' }, { status: 403 })

  const f = await request.formData()
  const file = f.get('file')
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'Adjunte el archivo.' }, { status: 400 })
  const fichero = { data: Buffer.from(await file.arrayBuffer()), mimetype: file.type || 'application/octet-stream', name: file.name, size: file.size }

  let documento = String(f.get('documento') ?? '').trim()
  const caducidad = fecha(f, 'fechaCaducidad')
  const pedidos = String(f.get('antelacionMeses') ?? '').trim()
  const heredada = String(f.get('antelacionHeredada') ?? '').trim()
  const aviso = pedidos !== '' && pedidos !== heredada && caducidad ? restarMeses(new Date(caducidad), Number(pedidos)).toISOString() : undefined
  try {
    if (!documento) {
      const titulo = String(f.get('titulo') ?? '').trim() || file.name
      const categoria = String(f.get('categoria') ?? '').trim()
      const empresa = String(f.get('empresa') ?? '').trim()
      if (!categoria || !empresa) return NextResponse.json({ error: 'Indique la categoría, o asócielo a un documento existente.' }, { status: 400 })
      const doc = await crearDocumento(req, {
        titulo,
        empresa: Number(empresa),
        categoria: Number(categoria),
        fechaEmision: fecha(f, 'fechaEmision'),
        fechaCaducidad: caducidad,
        fechaAviso: aviso,
      })
      documento = String(doc.id)
    } else if (caducidad || aviso) {
      await actualizarDocumento(req, documento, { ...(caducidad ? { fechaCaducidad: caducidad } : {}), ...(aviso ? { fechaAviso: aviso } : {}) })
    }

    await crearArchivo(req, {
      documento: Number(documento),
      relacion: String(f.get('relacion') ?? '').trim() || 'Original',
      nuevaCaducidad: caducidad,
      comentario: String(f.get('comentario') ?? '').trim() || undefined,
    }, fichero)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || 'No se ha podido subir el archivo.' }, { status: 400 })
  }

  return NextResponse.json({ id: documento })
}
