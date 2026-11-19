import config from '@payload-config'
import { getPayload } from 'payload'

// En Vercel no hay un proceso permanente que dispare la cola: este endpoint lo llama el cron de vercel.json.
export const maxDuration = 300

const autorizado = (req: Request) => {
  const secreto = process.env.CRON_SECRET
  return Boolean(secreto) && req.headers.get('authorization') === `Bearer ${secreto}`
}

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const payload = await getPayload({ config })

  await payload.jobs.queue({ task: 'recalcularEstados', queue: 'nocturna', input: {} })
  if (new Date().getUTCDay() === 1) await payload.jobs.queue({ task: 'resumenSemanal', queue: 'nocturna', input: {} })

  const nocturna = await payload.jobs.run({ queue: 'nocturna', limit: 10, sequential: true })
  // Los correos que programa la tarea nocturna, y los que fallaron antes, se envían aquí.
  const correo = await payload.jobs.run({ queue: 'correo', limit: 500 })

  return Response.json({ ok: true, nocturna: nocturna.jobStatus ?? null, correo: correo.jobStatus ? Object.keys(correo.jobStatus).length : 0 })
}
