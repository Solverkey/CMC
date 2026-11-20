import { recalcularEstados, resumenSemanal } from '@/jobs/recalcularEstados'
import { vaciarCola } from '@/lib/correo'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const autorizado = (req: Request) => {
  const secreto = process.env.CRON_SECRET
  return Boolean(secreto) && req.headers.get('authorization') === `Bearer ${secreto}`
}

export async function GET(req: Request) {
  if (!autorizado(req)) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const nocturna = await recalcularEstados()
  const resumen = new Date().getUTCDay() === 1 ? await resumenSemanal() : null
  const correo = await vaciarCola(500)
  return Response.json({ ok: true, nocturna, resumen, correo })
}
