import { after } from 'next/server'
import type { PayloadRequest } from 'payload'
import { registrar } from './actividad'
import { firmar } from './cifrado'
import { leerConfiguracion, urlServidor, type Config } from './configuracion'
import type { ClavePlantilla } from './plantillas'
import { escaparHtml, rellenar } from './texto'

type Destinatario = { email: string; usuario?: number | string | null; tipo: 'cliente' | 'cmc' }

export type Programar = {
  plantilla: ClavePlantilla
  para: Destinatario[]
  vars: Record<string, string | number | null | undefined>
  enlace?: string
  empresa?: number | string | null
  documento?: number | string | null
  hilo?: number | string | null
  /** Evita enviar dos veces el mismo aviso: se combina con el email del destinatario. */
  idempotencia?: string
  /** Para correos con un enlace de un solo uso (contraseñas): no se guarda el HTML en el registro. */
  sensible?: boolean
  responderA?: string
}

const parrafos = (texto: string) =>
  texto
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${escaparHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')

export function maquetar(cfg: Config, { asunto, cuerpo, boton, enlace, pixel }: { asunto: string; cuerpo: string; boton?: string; enlace?: string; pixel?: string }) {
  const color = cfg.colorPrimario
  const logo = cfg.logoUrl ? `<img src="${escaparHtml(cfg.logoUrl.startsWith('http') ? cfg.logoUrl : urlServidor() + cfg.logoUrl)}" alt="CMC" height="40" style="display:block;height:40px">` : `<span style="font:600 26px/1 Arial,sans-serif;letter-spacing:.04em;color:${color}">CMC</span>`
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escaparHtml(asunto)}</title></head>
<body style="margin:0;background:#f8f6ee;font:16px/24px Arial,Helvetica,sans-serif;color:#1e2a2b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6ee;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #dcd7c3;border-radius:16px">
<tr><td style="padding:24px 32px;border-bottom:4px solid ${color}">${logo}</td></tr>
<tr><td style="padding:32px">
<h1 style="margin:0 0 16px;font:600 20px/28px Arial,sans-serif">${escaparHtml(asunto)}</h1>
${parrafos(cuerpo)}
${enlace && boton ? `<p style="margin:24px 0"><a href="${escaparHtml(enlace)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px">${escaparHtml(boton)}</a></p>` : ''}
<p style="margin:24px 0 0;font-size:13px;line-height:18px;color:#56625f">Por seguridad, los documentos no se adjuntan: consúltelos en el portal.</p>
</td></tr>
<tr><td style="padding:16px 32px;background:#efece0;border-radius:0 0 16px 16px;font-size:13px;line-height:18px;color:#56625f">${parrafos(cfg.firma)}</td></tr>
</table></td></tr></table>${pixel ? `<img src="${pixel}" width="1" height="1" alt="" style="display:block">` : ''}
</body></html>`
}

/**
 * Programa un correo por destinatario. Queda registrado como «pendiente» y lo envía la cola `correo`
 * (con reintentos). Devuelve los IDs creados.
 */
export async function programarCorreo(req: PayloadRequest, p: Programar) {
  const vistos = new Set<string>()
  const para = p.para.filter((d) => {
    const e = d.email?.trim().toLowerCase()
    if (!e || vistos.has(e)) return false
    vistos.add(e)
    return true
  })
  if (!para.length) return []
  const cfg = await leerConfiguracion(req.payload, req)
  const t = cfg.plantilla(p.plantilla)
  const asunto = rellenar(t.asunto, p.vars)
  const cuerpo = rellenar(t.cuerpo, p.vars)
  const ids: (number | string)[] = []

  for (const d of para) {
    const clave = p.idempotencia ? `${p.idempotencia}|${d.email.toLowerCase()}` : undefined
    if (clave) {
      const ya = await req.payload.count({ collection: 'correos', where: { idempotencia: { equals: clave } }, overrideAccess: true, req })
      if (ya.totalDocs) continue
    }
    const correo = await req.payload.create({
      collection: 'correos',
      overrideAccess: true,
      req,
      data: {
        para: d.email,
        usuario: (d.usuario as number | null | undefined) ?? null,
        destinatario: d.tipo,
        plantilla: p.plantilla,
        asunto,
        texto: p.sensible ? '(contenido con enlace de un solo uso, no se conserva)' : cuerpo,
        empresa: (p.empresa as number) ?? null,
        documento: (p.documento as number) ?? null,
        hilo: (p.hilo as number) ?? null,
        idempotencia: clave,
        estado: 'pendiente',
      },
    })
    const pixel = `${urlServidor()}/api/correos/${correo.id}/abierto?f=${firmar(String(correo.id), 'pixel')}`
    const html = maquetar(cfg, { asunto, cuerpo, boton: t.boton, enlace: p.enlace, pixel })
    await req.payload.jobs.queue({
      task: 'enviarCorreo',
      queue: 'correo',
      input: { correo: String(correo.id), html, desde: `"${cfg.remitenteNombre.replace(/"/g, '')}" <${cfg.remitenteEmail}>`, responderA: p.responderA ?? cfg.responderA ?? '' },
      req,
    })
    await registrar(req, { accion: 'correo', descripcion: `Correo «${asunto}» programado para ${d.email}`, empresa: p.empresa, coleccion: 'correos', registroId: correo.id })
    ids.push(correo.id)
  }
  if (ids.length && req.context.origen !== 'sistema') enviarAlResponder(req)
  return ids
}

/** Envía la cola en cuanto termina la petición. Las tareas programadas (origen «sistema») la vacían ellas mismas. */
function enviarAlResponder(req: PayloadRequest) {
  try {
    after(async () => {
      await req.payload.jobs.run({ queue: 'correo', limit: 50, silent: { info: true } })
    })
  } catch {
    // Fuera de una petición (seed, scripts): lo envía la próxima ejecución de la cola.
  }
}
