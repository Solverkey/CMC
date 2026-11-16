import type { TaskConfig } from 'payload'
import { calcularEstado } from '../lib/estado'

/** Recalcula cada noche el semáforo de todos los documentos (las fechas avanzan aunque nadie edite). */
export const recalcularEstados: TaskConfig<'recalcularEstados'> = {
  slug: 'recalcularEstados',
  schedule: [{ cron: '0 3 * * *', queue: 'nocturna' }],
  handler: async ({ req }) => {
    let page = 1
    let cambiados = 0
    for (;;) {
      const res = await req.payload.find({ collection: 'documentos', limit: 200, page, depth: 0, req })
      for (const d of res.docs) {
        const nuevo = calcularEstado(d)
        if (nuevo !== d.estado) {
          await req.payload.update({ collection: 'documentos', id: d.id, data: { estado: nuevo }, req })
          cambiados++
          // TODO avisos por correo (RF-17): al pasar a naranja o rojo, enviar la plantilla según la modalidad de gestión.
        }
      }
      if (!res.hasNextPage) break
      page++
    }
    return { output: { cambiados } }
  },
}
