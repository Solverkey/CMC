import { after } from 'next/server'
import nodemailer from 'nodemailer'
import { registrar } from './actividad'
import type { Ctx } from './ctx'
import { firmar } from './cifrado'
import { leerConfiguracion, urlServidor, type Config } from './configuracion'
import { ahora, ejecutar, filas, jsonParam, jsonSql, uno } from './db'
import type { ClavePlantilla } from './plantillas'
import { escaparHtml, rellenar } from './texto'

type Destinatario = { email: string; usuario?: number | string | null; tipo: 'cliente' | 'cmc' }

export type Programar = {
  plantilla: ClavePlantilla
  para: Destinatario[]
  vars: Record<string, string | number | null | undefined>
  enlace?: string
  asunto?: string
  cuerpo?: string
  empresa?: number | string | null
  documento?: number | string | null
  hilo?: number | string | null
  idempotencia?: string
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

const transporte = () =>
  process.env.SMTP_HOST
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      })
    : nodemailer.createTransport({ jsonTransport: true })

/**
 * Programa un correo por destinatario. Queda en `correos` como pendiente y se envía al terminar la petición
 * (o en el cron, si el origen es el sistema).
 */
export async function programarCorreo(req: Ctx, p: Programar) {
  const vistos = new Set<string>()
  const para = p.para.filter((d) => {
    const e = d.email?.trim().toLowerCase()
    if (!e || vistos.has(e)) return false
    vistos.add(e)
    return true
  })
  if (!para.length) return []
  const cfg = await leerConfiguracion()
  const t = cfg.plantilla(p.plantilla)
  const asunto = rellenar(p.asunto || t.asunto, p.vars)
  const cuerpo = rellenar(p.cuerpo || t.cuerpo, p.vars)
  const ids: number[] = []
  const momento = ahora()

  for (const d of para) {
    const clave = p.idempotencia ? `${p.idempotencia}|${d.email.toLowerCase()}` : undefined
    if (clave) {
      const ya = await uno<{ id: number }>('SELECT id FROM correos WHERE idempotencia = $1', [clave])
      if (ya) continue
    }
    const correo = await uno<{ id: number }>(
      `INSERT INTO correos (asunto, para, usuario_id, destinatario, plantilla, texto, empresa_id, documento_id, hilo_id, idempotencia, estado, updated_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pendiente', $11, $11) RETURNING id`,
      [
        asunto,
        d.email,
        d.usuario ?? null,
        d.tipo,
        p.plantilla,
        p.sensible ? '(contenido con enlace de un solo uso, no se conserva)' : cuerpo,
        p.empresa ?? null,
        p.documento ?? null,
        p.hilo ?? null,
        clave ?? null,
        momento,
      ],
    )
    if (!correo) continue
    const pixel = `${urlServidor()}/api/correos/${correo.id}/abierto?f=${firmar(String(correo.id), 'pixel')}`
    const html = maquetar(cfg, { asunto, cuerpo, boton: t.boton, enlace: p.enlace, pixel })
    const desde = `"${cfg.remitenteNombre.replace(/"/g, '')}" <${cfg.remitenteEmail}>`
    await ejecutar(`INSERT INTO payload_kv (key, data) VALUES ($1, ${jsonSql(2)})`, [
      `correo:${correo.id}`,
      jsonParam({ html, desde, responderA: p.responderA ?? cfg.responderA ?? '', intentos: 0 }),
    ])
    await registrar(req, { accion: 'correo', descripcion: `Correo «${asunto}» programado para ${d.email}`, empresa: p.empresa, coleccion: 'correos', registroId: correo.id })
    ids.push(correo.id)
  }
  if (ids.length && req.origen !== 'sistema' && req.context.origen !== 'sistema') enviarAlResponder()
  return ids
}

function enviarAlResponder() {
  try {
    after(async () => {
      await vaciarCola(50)
    })
  } catch {
    // Fuera de una petición (seed, scripts): lo envía la próxima ejecución del cron.
  }
}

/** Envía los correos pendientes. El cron nocturno llama aquí con un límite alto. */
export async function vaciarCola(limite = 50) {
  const pendientes = await filas<{ id: number; para: string; asunto: string; empresa_id: number | null }>(
    `SELECT id, para, asunto, empresa_id FROM correos WHERE estado IN ('pendiente', 'error') ORDER BY id LIMIT $1`,
    [limite],
  )
  const mailer = transporte()
  let enviados = 0
  let errores = 0
  for (const correo of pendientes) {
    const guardado = await uno<{ data: unknown }>('SELECT data FROM payload_kv WHERE key = $1', [`correo:${correo.id}`])
    const data = (typeof guardado?.data === 'string' ? JSON.parse(guardado.data) : guardado?.data) as { html?: string; desde?: string; responderA?: string; intentos?: number } | null
    if (!data?.html || !data.desde) continue
    if ((data.intentos ?? 0) >= 4) continue
    try {
      const res = await mailer.sendMail({
        from: data.desde,
        to: correo.para,
        subject: correo.asunto,
        html: data.html,
        ...(data.responderA ? { replyTo: data.responderA } : {}),
      })
      await ejecutar(
        `UPDATE correos SET estado = 'enviado', enviado_en = $2, message_id = $3, error = NULL, updated_at = $2 WHERE id = $1`,
        [correo.id, ahora(), String(res.messageId ?? '').replace(/[<>]/g, '') || null],
      )
      await ejecutar('DELETE FROM payload_kv WHERE key = $1', [`correo:${correo.id}`])
      await registrar({ user: null, headers: new Headers(), origen: 'sistema', context: {} }, { accion: 'correo_enviado', descripcion: `Correo «${correo.asunto}» enviado a ${correo.para}`, empresa: correo.empresa_id, coleccion: 'correos', registroId: correo.id })
      enviados++
      if (!process.env.SMTP_HOST) console.info(`[correo] ${correo.para} · ${correo.asunto}`)
    } catch (err) {
      const intentos = (data.intentos ?? 0) + 1
      await ejecutar(`UPDATE correos SET estado = 'error', error = $2, updated_at = $3 WHERE id = $1`, [correo.id, String((err as Error).message ?? err).slice(0, 500), ahora()])
      await ejecutar(`UPDATE payload_kv SET data = ${jsonSql(2)} WHERE key = $1`, [`correo:${correo.id}`, jsonParam({ ...data, intentos })])
      errores++
      await registrar({ user: null, headers: new Headers(), origen: 'sistema', context: {} }, { accion: 'correo_error', descripcion: `Error al enviar «${correo.asunto}» a ${correo.para}`, empresa: correo.empresa_id, coleccion: 'correos', registroId: correo.id })
    }
  }
  return { revisados: pendientes.length, enviados, errores }
}
