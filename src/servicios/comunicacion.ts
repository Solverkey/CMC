import { esSuperAdmin, puedeVerEmpresa } from '@/access'
import { AppError } from '@/lib/appError'
import { registrar } from '@/lib/actividad'
import type { Ctx } from '@/lib/ctx'
import { urlServidor } from '@/lib/configuracion'
import { programarCorreo } from '@/lib/correo'
import { destinatariosCMC } from '@/lib/destinatarios'
import { ahora, ejecutar, filas, uno } from '@/lib/db'
import { guardarFichero, leerFichero } from '@/lib/ficheros'
import { crearPdf } from '@/lib/pdf'
import { prepararFichero, type Fichero } from '@/lib/subidas'
import { categoriaPorId, documentoPorId, empresaVisible, hiloPorId, marcarLeido, mensajesDeHilo } from '@/datos/consultas'
import { crearEnvio } from '@/datos/operaciones'
import { usuarioPorId } from '@/datos/usuarios'
import { mapAdjunto } from '@/datos/mapas'
import type { Adjunto, User } from '@/datos/tipos'

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number }).id : (v as number))

export async function subirAdjunto(req: Ctx, empresa: string | number, fichero: Fichero) {
  if (!puedeVerEmpresa(req.user, empresa)) throw new AppError('No tiene acceso a esa empresa.', 403)
  const preparado = await prepararFichero(fichero)
  const guardado = await guardarFichero('adjuntos', preparado.file)
  const momento = ahora()
  const row = await uno<{ id: number }>(
    `INSERT INTO adjuntos (empresa_id, subido_por_id, tamano_original, url, filename, mime_type, filesize, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`,
    [Number(empresa), req.user?.id ?? null, preparado.tamanoOriginal, guardado.url, guardado.filename, guardado.mimeType, guardado.filesize, momento],
  )
  const fresco = await uno<Record<string, unknown>>('SELECT * FROM adjuntos WHERE id = $1', [row!.id])
  return mapAdjunto(fresco!)
}

export async function crearHilo(req: Ctx, d: { empresa: string | number; asunto: string; texto: string; documento?: string | number | null; categoria?: string | number | null; adjuntos?: (string | number)[] }) {
  if (!d.asunto?.trim()) throw new AppError('Indique el asunto.', 400)
  if (!puedeVerEmpresa(req.user, d.empresa)) throw new AppError('No tiene acceso a esa empresa.', 403)
  if (!String(d.texto ?? '').trim()) throw new AppError('El mensaje está vacío.', 400)
  // El documento o la categoría tienen que ser de la misma empresa (y visibles para quien escribe).
  if (d.documento) {
    const doc = await documentoPorId(d.documento, req.user)
    if (!doc || String(idDe(doc.empresa)) !== String(d.empresa)) throw new AppError('Ese documento no es de esta empresa.', 400)
  }
  if (d.categoria) {
    const cat = await categoriaPorId(d.categoria)
    if (!cat || String(idDe(cat.empresa)) !== String(d.empresa)) throw new AppError('Esa instalación no es de esta empresa.', 400)
  }
  const momento = ahora()
  const row = await uno<{ id: number }>(
    `INSERT INTO hilos (asunto, empresa_id, categoria_id, documento_id, estado, creado_por_id, ultimo_mensaje, updated_at, created_at) VALUES ($1,$2,$3,$4,'abierto',$5,$6,$6,$6) RETURNING id`,
    [d.asunto.trim(), Number(d.empresa), d.categoria ? Number(d.categoria) : null, d.documento ? Number(d.documento) : null, req.user?.id ?? null, momento],
  )
  await registrar(req, { accion: 'mensaje', descripcion: `Nueva conversación «${d.asunto.trim()}»`, empresa: d.empresa, coleccion: 'hilos', registroId: row!.id })
  await escribirMensaje(req, { hilo: row!.id, texto: d.texto, adjuntos: d.adjuntos })
  return hiloPorId(row!.id)
}

export async function escribirMensaje(req: Ctx, d: { hilo: string | number; texto: string; adjuntos?: (string | number)[] }) {
  if (!req.user) throw new AppError('No autenticado.', 401)
  if (!String(d.texto ?? '').trim()) throw new AppError('El mensaje está vacío.', 400)
  const hilo = await hiloPorId(d.hilo)
  if (!hilo || !puedeVerEmpresa(req.user, idDe(hilo.empresa))) throw new AppError('No tiene acceso a esta conversación.', 403)
  for (const a of d.adjuntos ?? []) {
    const adj = await uno<{ empresa_id: number; subido_por_id: number }>('SELECT empresa_id, subido_por_id FROM adjuntos WHERE id = $1', [Number(a)])
    if (!adj || String(adj.empresa_id) !== String(idDe(hilo.empresa)) || String(adj.subido_por_id) !== String(req.user.id)) throw new AppError('Adjunto no válido.', 400)
  }
  const momento = ahora()
  const row = await uno<{ id: number }>(
    `INSERT INTO mensajes (hilo_id, texto, empresa_id, autor_id, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$5) RETURNING id`,
    [Number(d.hilo), d.texto.trim(), idDe(hilo.empresa), req.user.id, momento],
  )
  let orden = 1
  for (const a of d.adjuntos ?? []) {
    await ejecutar('INSERT INTO mensajes_rels ("order", parent_id, path, adjuntos_id) VALUES ($1,$2,$3,$4)', [orden++, row!.id, 'adjuntos', Number(a)])
  }
  await marcarLeido(hilo.id, req.user.id)
  const reabrir = !esSuperAdmin(req.user) && hilo.estado === 'resuelto'
  await ejecutar('UPDATE hilos SET ultimo_mensaje = $2, estado = $3, updated_at = $2 WHERE id = $1', [hilo.id, momento, reabrir ? 'abierto' : hilo.estado])
  await registrar(req, { accion: 'mensaje', descripcion: `Mensaje en «${hilo.asunto}»`, empresa: idDe(hilo.empresa), coleccion: 'mensajes', registroId: row!.id, datos: { hilo: hilo.id } })
  const previos = await filas<{ autor_id: number | null }>('SELECT autor_id FROM mensajes WHERE hilo_id = $1', [hilo.id])
  const participantes = new Map<string, User>()
  for (const id of [idDe(hilo.creadoPor), idDe(hilo.asignado), ...previos.map((m) => m.autor_id)].filter(Boolean)) {
    const u = await usuarioPorId(id as number)
    if (u) participantes.set(String(u.id), u)
  }
  participantes.delete(String(req.user.id))
  const para: { email: string; usuario?: number | string | null; tipo: 'cmc' | 'cliente' }[] = [...participantes.values()].filter((u) => u.activo !== false).map((u) => ({ email: u.email, usuario: u.id, tipo: u.rol === 'superadmin' ? 'cmc' : 'cliente' }))
  if (!hilo.asignado && !esSuperAdmin(req.user)) para.push(...(await destinatariosCMC(req)))
  const empresa = typeof hilo.empresa === 'object' ? hilo.empresa : null
  await programarCorreo(req, {
    plantilla: 'nuevo_mensaje',
    para: para.filter((x) => x.email !== req.user!.email),
    vars: { asunto: hilo.asunto, nombre: req.user.nombre, empresa: empresa?.razonSocial, mensaje: String(d.texto).slice(0, 600) },
    enlace: `${urlServidor()}/portal/mensajes/${hilo.id}`,
    empresa: idDe(hilo.empresa),
    hilo: hilo.id,
  })
  return row
}

export async function gestionarHilo(req: Ctx, id: number | string, data: { estado?: 'abierto' | 'resuelto'; asignado?: number | null }) {
  if (!esSuperAdmin(req.user)) throw new AppError('Solo CMC puede gestionar la conversación.', 403)
  const hilo = await hiloPorId(id)
  if (!hilo) throw new AppError('Conversación no encontrada.', 404)
  await ejecutar('UPDATE hilos SET estado = $2, asignado_id = $3, updated_at = $4 WHERE id = $1', [Number(id), data.estado ?? hilo.estado, data.asignado === undefined ? idDe(hilo.asignado) || null : data.asignado, ahora()])
  await registrar(req, { accion: 'edicion', descripcion: `Conversación «${hilo.asunto}» actualizada`, empresa: idDe(hilo.empresa), coleccion: 'hilos', registroId: hilo.id })
  return hiloPorId(id)
}

export async function adjuntoAEnvio(req: Ctx, d: { adjunto: string | number; titulo?: string; documentoRelacionado?: string | number | null; relacion?: string; nuevaCaducidad?: string | null }) {
  const row = await uno<Record<string, unknown>>('SELECT * FROM adjuntos WHERE id = $1', [Number(d.adjunto)])
  if (!row) throw new AppError('Adjunto no encontrado.', 404)
  const adj = mapAdjunto(row) as Adjunto
  if (!puedeVerEmpresa(req.user, adj.empresa as number)) throw new AppError('No tiene acceso.', 403)
  const data = await leerFichero('adjuntos', adj)
  return crearEnvio(
    req,
    {
      titulo: d.titulo?.trim() || adj.filename!,
      empresa: Number(idDe(adj.empresa)),
      documentoRelacionado: d.documentoRelacionado ? Number(d.documentoRelacionado) : undefined,
      relacion: d.relacion || (d.documentoRelacionado ? 'Renovación' : 'Original'),
      nuevaCaducidad: d.nuevaCaducidad || undefined,
      comentario: 'Enviado desde un adjunto de Comunicación',
    },
    { data, name: adj.filename!, mimetype: adj.mimeType ?? 'application/octet-stream', size: data.length },
  )
}

export async function exportarHistorial(req: Ctx, d: { empresa: string | number; documento?: string | number | null }) {
  if (!puedeVerEmpresa(req.user, d.empresa)) throw new AppError('No tiene acceso a esa empresa.', 403)
  const empresa = await empresaVisible(req.user, d.empresa)
  if (!empresa) throw new AppError('No tiene acceso a esa empresa.', 403)
  const extra = d.documento ? 'AND documento_id = $2' : ''
  const params = d.documento ? [Number(empresa.id), Number(d.documento)] : [Number(empresa.id)]
  const { listarHilos } = await import('@/datos/consultas')
  const hilos = await listarHilos(req.user, `AND empresa_id = $1 ${extra} ORDER BY created_at`, params)
  const pdf = await crearPdf(`Comunicaciones · ${empresa.razonSocial}`, `${d.documento ? 'Documento ' + d.documento + ' · ' : ''}${hilos.length} conversaciones · generado el ${new Date().toLocaleString('es-ES')}`)
  for (const h of hilos) {
    const asignado = typeof h.asignado === 'object' && h.asignado ? ` · ASIGNADA A ${(h.asignado as User).nombre}` : ''
    pdf.bloque(`CONVERSACIÓN · ${h.estado === 'resuelto' ? 'RESUELTA' : 'ABIERTA'}${asignado}`, h.asunto)
    const msgs = await mensajesDeHilo(h.id)
    for (const m of msgs) {
      const autor = await usuarioPorId(idDe(m.autor) || 0)
      const nombre = autor ? `${autor.nombre} <${autor.email}>` : 'Usuario'
      const adjuntos = (m.adjuntos ?? []).map((a) => (typeof a === 'object' ? a.filename : a)).filter(Boolean)
      pdf.bloque(`${new Date(m.createdAt).toLocaleString('es-ES')} · ${nombre}`, m.texto + (adjuntos.length ? `\nAdjuntos: ${adjuntos.join(', ')}` : ''))
    }
  }
  await registrar(req, { accion: 'exportacion', descripcion: `Exportación del historial de comunicaciones de «${empresa.razonSocial}»`, empresa: empresa.id, coleccion: 'hilos' })
  return { data: await pdf.guardar(), nombre: `Comunicaciones ${empresa.razonSocial.replace(/[\\/:*?"<>|]+/g, '-')}.pdf`, mime: 'application/pdf' }
}
