import crypto from 'crypto'
import { esSuperAdmin, puedeVerEmpresa } from '@/access'
import { AppError } from '@/lib/appError'
import { cambios, registrar } from '@/lib/actividad'
import type { Ctx } from '@/lib/ctx'
import { ahora, bit, ejecutar, uno } from '@/lib/db'
import { efectosDe, usarNombre } from '@/lib/catalogo'
import { leerConfiguracion, urlServidor } from '@/lib/configuracion'
import { programarCorreo } from '@/lib/correo'
import { destinatariosCliente, destinatariosCMC, tecnicoResponsable, usuariosEmpresa } from '@/lib/destinatarios'
import { ESTADOS, calcularEstado, resolverGestion, restarMeses, type Estado } from '@/lib/estado'
import { guardarFichero, leerFichero } from '@/lib/ficheros'
import { prepararFichero, tamano, type Fichero } from '@/lib/subidas'
import { enlazarArchivoDeEnvio } from './adjuntos'
import { archivoPorId, categoriaPorId, documentoPorId, empresaPorId, envioPorId } from './consultas'
import type { Documento, Empresa } from './tipos'

const idDe = (v: unknown) => (v && typeof v === 'object' && 'id' in v ? (v as { id: number }).id : (v as number | null))
const dia = (v: unknown) => (v ? new Date(v as string).toISOString().slice(0, 10) : null)

type DatosDoc = {
  titulo: string
  empresa: number
  categoria: number
  referencia?: string | null
  organismo?: string | null
  fechaEmision?: string | null
  fechaCaducidad?: string | null
  fechaAviso?: string | null
  estadoManual?: Documento['estadoManual']
  motivoEstado?: string | null
  limiteSubsanacion?: string | null
  gestion?: Documento['gestion']
  observaciones?: string | null
  tecnico?: number | null
}

async function prepararDatos(ctx: Ctx, data: DatosDoc, anterior?: Documento | null) {
  const cat = await categoriaPorId(data.categoria)
  if (cat && String(idDe(cat.empresa)) !== String(data.empresa)) throw new AppError('La instalación elegida pertenece a otra empresa.')
  const empresa = await empresaPorId(data.empresa)
  const caducidad = data.fechaCaducidad
  const avisoCambiado = anterior ? dia(data.fechaAviso) !== dia(anterior.fechaAviso) && data.fechaAviso != null : Boolean(data.fechaAviso)
  const cambioCaducidad = !anterior || dia(caducidad) !== dia(anterior.fechaCaducidad)
  let fechaAviso = data.fechaAviso ?? null
  let avisoManual = false
  if (!caducidad) {
    fechaAviso = null
    avisoManual = false
  } else if (avisoCambiado && fechaAviso) {
    avisoManual = true
  } else if (cambioCaducidad || !fechaAviso) {
    const cfg = await leerConfiguracion()
    const meses = typeof cat?.antelacionMeses === 'number' ? cat.antelacionMeses : typeof empresa?.antelacionMeses === 'number' ? empresa.antelacionMeses : cfg.antelacionMeses
    fechaAviso = restarMeses(new Date(caducidad), meses ?? 2).toISOString()
    avisoManual = false
  }
  const estado = calcularEstado({ fechaCaducidad: caducidad, fechaAviso, estadoManual: data.estadoManual })
  return { cat, empresa, fechaAviso, avisoManual, estado }
}

export async function crearDocumento(ctx: Ctx, data: DatosDoc) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC puede publicar documentos.', 403)
  const prep = await prepararDatos(ctx, data)
  const momento = ahora()
  const row = await uno<{ id: number }>(
    `INSERT INTO documentos (titulo, empresa_id, categoria_id, referencia, organismo, fecha_emision, fecha_caducidad, fecha_aviso, aviso_manual, estado, estado_manual, motivo_estado, limite_subsanacion, gestion, tecnico_id, observaciones, updated_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$17) RETURNING id`,
    [
      data.titulo,
      data.empresa,
      data.categoria,
      data.referencia ?? null,
      data.organismo ?? null,
      data.fechaEmision ?? null,
      data.fechaCaducidad ?? null,
      prep.fechaAviso,
      bit(prep.avisoManual),
      prep.estado,
      data.estadoManual ?? null,
      data.motivoEstado ?? null,
      data.limiteSubsanacion ?? null,
      data.gestion ?? null,
      data.tecnico ?? null,
      data.observaciones ?? null,
      momento,
    ],
  )
  const doc = (await documentoPorId(row!.id))!
  await usarNombre(ctx, 'documento', doc.titulo)
  await registrar(ctx, { accion: 'alta', descripcion: `Alta del documento «${doc.titulo}»`, empresa: data.empresa, coleccion: 'documentos', registroId: doc.id })
  return doc
}

export async function actualizarDocumento(ctx: Ctx, id: number | string, data: Partial<DatosDoc>, { sinAvisos = false } = {}) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC puede editar documentos.', 403)
  const anterior = await documentoPorId(id)
  if (!anterior) throw new AppError('Documento no encontrado.', 404)
  const junto: DatosDoc = {
    titulo: data.titulo ?? anterior.titulo,
    empresa: Number(data.empresa ?? idDe(anterior.empresa)),
    categoria: Number(data.categoria ?? idDe(anterior.categoria)),
    referencia: data.referencia !== undefined ? data.referencia : anterior.referencia,
    organismo: data.organismo !== undefined ? data.organismo : anterior.organismo,
    fechaEmision: data.fechaEmision !== undefined ? data.fechaEmision : anterior.fechaEmision,
    fechaCaducidad: data.fechaCaducidad !== undefined ? data.fechaCaducidad : anterior.fechaCaducidad,
    fechaAviso: data.fechaAviso !== undefined ? data.fechaAviso : anterior.fechaAviso,
    estadoManual: data.estadoManual !== undefined ? data.estadoManual : anterior.estadoManual,
    motivoEstado: data.motivoEstado !== undefined ? data.motivoEstado : anterior.motivoEstado,
    limiteSubsanacion: data.limiteSubsanacion !== undefined ? data.limiteSubsanacion : anterior.limiteSubsanacion,
    gestion: data.gestion !== undefined ? data.gestion : anterior.gestion,
    observaciones: data.observaciones !== undefined ? data.observaciones : anterior.observaciones,
    tecnico: data.tecnico !== undefined ? data.tecnico : (idDe(anterior.tecnico) as number | null),
  }
  const prep = await prepararDatos(ctx, junto, anterior)
  const momento = ahora()
  await ejecutar(
    `UPDATE documentos SET titulo=$2, empresa_id=$3, categoria_id=$4, referencia=$5, organismo=$6, fecha_emision=$7, fecha_caducidad=$8, fecha_aviso=$9, aviso_manual=$10, estado=$11, estado_manual=$12, motivo_estado=$13, limite_subsanacion=$14, gestion=$15, tecnico_id=$16, observaciones=$17, updated_at=$18 WHERE id=$1`,
    [Number(id), junto.titulo, junto.empresa, junto.categoria, junto.referencia ?? null, junto.organismo ?? null, junto.fechaEmision ?? null, junto.fechaCaducidad ?? null, prep.fechaAviso, bit(prep.avisoManual), prep.estado, junto.estadoManual ?? null, junto.motivoEstado ?? null, junto.limiteSubsanacion ?? null, junto.gestion ?? null, junto.tecnico ?? null, junto.observaciones ?? null, momento],
  )
  const doc = (await documentoPorId(id))!
  if (doc.titulo !== anterior.titulo) await usarNombre(ctx, 'documento', doc.titulo)
  const manual = (doc.estadoManual ?? null) !== (anterior.estadoManual ?? null)
  const diff = cambios(anterior as unknown as Record<string, unknown>, doc as unknown as Record<string, unknown>)
  delete diff.estado
  delete diff.updatedAt
  if (anterior.estado !== doc.estado || manual) {
    delete diff.estadoManual
    delete diff.motivoEstado
    const manualDe = (v: unknown) => (v ? ESTADOS[v as Estado]?.label : 'ninguno')
    await registrar(ctx, {
      accion: 'cambio_estado',
      descripcion:
        anterior.estado !== doc.estado
          ? `«${doc.titulo}»: ${ESTADOS[anterior.estado as Estado]?.label ?? '—'} → ${ESTADOS[doc.estado as Estado].label}${manual ? ' (manual)' : ' (automático)'}`
          : `«${doc.titulo}»: estado manual ${manualDe(anterior.estadoManual)} → ${manualDe(doc.estadoManual)} (se mantiene ${ESTADOS[doc.estado as Estado].label})`,
      empresa: junto.empresa,
      coleccion: 'documentos',
      registroId: doc.id,
      datos: { antes: anterior.estado, despues: doc.estado, manual, estadoManual: doc.estadoManual ?? null, motivo: manual ? doc.motivoEstado ?? null : 'Cálculo por fechas' },
    })
    const colorCambia = anterior.estado !== doc.estado
    if ((colorCambia || manual) && !sinAvisos && !ctx.context.sinAvisos && junto.empresa && prep.empresa) {
      const gestionado = resolverGestion(prep.empresa.gestion, prep.cat?.gestion, doc.gestion) === 'gestionado'
      const antes = ESTADOS[anterior.estado as Estado]?.label ?? '—'
      const despues = ESTADOS[doc.estado as Estado].label
      const motivo = doc.motivoEstado ? ` Motivo: ${doc.motivoEstado}` : ''
      const cierre = gestionado ? 'No necesita hacer nada: CMC lo gestiona y le avisaremos cuando el nuevo documento esté disponible.' : 'Revíselo y, cuando disponga del nuevo, súbalo al portal o envíenoslo.'
      const asunto = colorCambia
        ? gestionado ? `«{{documento}}» pasa a ${despues} — CMC se encarga` : `«{{documento}}» pasa a ${despues} — requiere su revisión`
        : gestionado ? `«{{documento}}» se mantiene en ${despues} — CMC se encarga` : `«{{documento}}» se mantiene en ${despues} — requiere su revisión`
      const cuerpo = colorCambia
        ? `El documento «{{documento}}» de {{empresa}} ha pasado de ${antes} a ${despues}.${motivo} ${cierre}`
        : `El estado manual del documento «{{documento}}» de {{empresa}} ha pasado de ${manualDe(anterior.estadoManual)} a ${manualDe(doc.estadoManual)}. El color se mantiene en ${despues}.${motivo} ${cierre}`
      await programarCorreo(ctx, {
        plantilla: gestionado ? 'proxima_gestionado' : 'proxima_no_gestionado',
        asunto,
        cuerpo,
        para: await destinatariosCliente(ctx, prep.empresa),
        vars: { documento: doc.titulo, empresa: prep.empresa.razonSocial },
        enlace: `${urlServidor()}/portal/documentos/${doc.id}`,
        empresa: prep.empresa.id,
        documento: doc.id,
        idempotencia: `estado|${doc.id}|${anterior.estado}|${doc.estado}|${anterior.estadoManual ?? ''}|${doc.estadoManual ?? ''}|${doc.updatedAt}`,
      })
    }
  }
  if (Object.keys(diff).length) {
    await registrar(ctx, {
      accion: 'edicion',
      descripcion: diff.categoria ? `Documento «${doc.titulo}» movido de instalación` : `Edición del documento «${doc.titulo}»`,
      empresa: junto.empresa,
      coleccion: 'documentos',
      registroId: doc.id,
      datos: { cambios: diff },
    })
  }
  return doc
}

/** Recalcula solo el color. Lo usa la tarea nocturna; el aviso de cambio de estado sale igual. */
export async function fijarEstado(ctx: Ctx, id: number, estado: Documento['estado']) {
  const anterior = await documentoPorId(id)
  if (!anterior || anterior.estado === estado) return anterior
  return actualizarDocumento(ctx, id, { estadoManual: anterior.estadoManual, fechaCaducidad: anterior.fechaCaducidad, fechaAviso: anterior.fechaAviso })
}

export async function crearArchivo(ctx: Ctx, data: { documento: number; relacion?: string; efectos?: string[] | null; nuevaCaducidad?: string | null; nuevoAviso?: string | null; comentario?: string | null }, fichero: Fichero, { sinComprimir = false, sinAvisos = false } = {}) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC puede asociar archivos.', 403)
  const doc = await documentoPorId(data.documento)
  if (!doc) throw new AppError('Documento no encontrado.', 404)
  const relacion = String(data.relacion ?? 'Original').trim()
  const efectos = data.efectos?.length ? data.efectos : await efectosDe(ctx, relacion)
  if (!efectos) throw new AppError(`«${relacion}» es un tipo de relación nuevo: indique su efecto.`)
  if (efectos.includes('actualiza_fechas') && !data.nuevaCaducidad) throw new AppError('Este tipo de relación actualiza fechas: indique la nueva caducidad.')
  const preparado = await prepararFichero(fichero, { sinComprimir: sinComprimir || Boolean(ctx.context.sinComprimir) })
  const guardado = await guardarFichero('archivos', preparado.file)
  const momento = ahora()
  const row = await uno<{ id: number }>(
    `INSERT INTO archivos (documento_id, empresa_id, relacion, nueva_caducidad, nuevo_aviso, comentario, historico, tamano_original, subido_por_id, url, filename, mime_type, filesize, width, height, updated_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16) RETURNING id`,
    [data.documento, idDe(doc.empresa), relacion, data.nuevaCaducidad ?? null, data.nuevoAviso ?? null, data.comentario ?? null, bit(false), preparado.tamanoOriginal, ctx.user?.id ?? null, guardado.url, guardado.filename, guardado.mimeType, guardado.filesize, guardado.width ?? null, guardado.height ?? null, momento],
  )
  let orden = 1
  for (const valor of efectos) {
    await ejecutar('INSERT INTO archivos_efectos ("order", parent_id, value) VALUES ($1, $2, $3)', [orden++, row!.id, valor])
  }
  if (efectos.includes('sustituye')) {
    await ejecutar('UPDATE archivos SET historico = $1, updated_at = $2 WHERE documento_id = $3 AND id != $4 AND (historico IS NULL OR historico IS NOT TRUE)', [bit(true), momento, data.documento, row!.id])
    await ejecutar('UPDATE documentos SET archivo_vigente_id = $2, updated_at = $3 WHERE id = $1', [data.documento, row!.id, momento])
  }
  const update: Partial<DatosDoc> = {}
  if (efectos.includes('actualiza_fechas') && data.nuevaCaducidad) {
    update.fechaCaducidad = data.nuevaCaducidad
    if (data.nuevoAviso) update.fechaAviso = data.nuevoAviso
    update.estadoManual = null
    update.motivoEstado = null
  }
  if (efectos.includes('levanta') && doc.estadoManual === 'naranja') {
    update.estadoManual = null
    update.motivoEstado = null
  }
  if (Object.keys(update).length) await actualizarDocumento(ctx, data.documento, update, { sinAvisos })
  await usarNombre(ctx, 'relacion', relacion, { efectos })
  const actual = await documentoPorId(data.documento)
  await registrar(ctx, {
    accion: 'subida',
    descripcion: `${relacion} «${guardado.filename}» en «${actual?.titulo ?? doc.titulo}» (${tamano(guardado.filesize)}${preparado.tamanoOriginal ? `, original ${tamano(preparado.tamanoOriginal)}` : ''})`,
    empresa: idDe(doc.empresa),
    coleccion: 'archivos',
    registroId: row!.id,
  })
  if (!sinAvisos && !ctx.context.sinAvisos && actual) {
    const empresa = typeof actual.empresa === 'object' ? actual.empresa : await empresaPorId(actual.empresa)
    if (empresa) {
      await programarCorreo(ctx, {
        plantilla: 'renovacion_disponible',
        para: await usuariosEmpresa(ctx, empresa.id),
        vars: { documento: actual.titulo, empresa: empresa.razonSocial, tipo: relacion.toLowerCase() },
        enlace: `${urlServidor()}/portal/documentos/${data.documento}`,
        empresa: empresa.id,
        documento: data.documento,
      })
    }
  }
  if (preparado.original) await guardarOriginal(ctx, 'archivos', row!.id, idDe(doc.empresa) as number, preparado.original)
  return archivoPorId(row!.id)
}

async function guardarOriginal(ctx: Ctx, coleccion: string, registroId: number, empresa: number | null, file: Fichero) {
  const guardado = await guardarFichero('originales', file)
  const momento = ahora()
  await ejecutar(
    `INSERT INTO originales (coleccion, registro_id, empresa_id, url, filename, mime_type, filesize, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
    [coleccion, String(registroId), empresa, guardado.url, guardado.filename, guardado.mimeType, guardado.filesize, momento],
  )
  void ctx
}

export async function crearEnvio(ctx: Ctx, data: { titulo: string; empresa: number; documentoRelacionado?: number | null; relacion?: string | null; nuevaCaducidad?: string | null; comentario?: string | null }, fichero: Fichero) {
  if (!ctx.user) throw new AppError('No autenticado.', 401)
  if (!puedeVerEmpresa(ctx.user, data.empresa)) throw new AppError('No tiene acceso a esa empresa.', 403)
  if (data.documentoRelacionado) {
    const rel = await documentoPorId(data.documentoRelacionado, ctx.user)
    if (!rel || String(idDe(rel.empresa)) !== String(data.empresa)) throw new AppError('El documento indicado no pertenece a esa empresa.')
  }
  const preparado = await prepararFichero(fichero)
  const guardado = await guardarFichero('envios', preparado.file)
  const momento = ahora()
  const row = await uno<{ id: number }>(
    `INSERT INTO envios (titulo, empresa_id, documento_relacionado_id, relacion, nueva_caducidad, comentario, estado, tamano_original, enviado_por_id, url, filename, mime_type, filesize, updated_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,'pendiente',$7,$8,$9,$10,$11,$12,$13,$13) RETURNING id`,
    [data.titulo, data.empresa, data.documentoRelacionado ?? null, data.relacion ?? 'Renovación', data.nuevaCaducidad ?? null, data.comentario ?? null, preparado.tamanoOriginal, ctx.user.id, guardado.url, guardado.filename, guardado.mimeType, guardado.filesize, momento],
  )
  const empresa = await empresaPorId(data.empresa)
  await registrar(ctx, { accion: 'envio', descripcion: `Envío a revisión «${data.titulo}» (${guardado.filename})`, empresa: data.empresa, coleccion: 'envios', registroId: row!.id })
  if (empresa && !esSuperAdmin(ctx.user)) {
    const tecnico = await tecnicoResponsable(ctx, { tecnico: null }, null, empresa)
    await programarCorreo(ctx, {
      plantilla: 'envio_recibido',
      para: [...(tecnico ? [{ email: tecnico.email, usuario: tecnico.id, tipo: 'cmc' as const }] : []), ...(await destinatariosCMC(ctx))],
      vars: { empresa: empresa.razonSocial, documento: data.titulo, nombre: ctx.user.nombre },
      enlace: `${urlServidor()}/portal/enviar/${row!.id}`,
      empresa: empresa.id,
    })
  }
  if (preparado.original) await guardarOriginal(ctx, 'envios', row!.id, data.empresa, preparado.original)
  return envioPorId(row!.id)
}

export async function resolverEnvio(
  ctx: Ctx,
  id: number | string,
  data: {
    estado: 'publicado' | 'rechazado'
    motivoRechazo?: string | null
    documentoDestino?: number | null
    categoriaDestino?: number | null
    tituloFinal?: string | null
    relacionFinal?: string | null
    fechaEmision?: string | null
    fechaCaducidad?: string | null
    fechaAviso?: string | null
  },
) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC puede resolver un envío.', 403)
  const envio = await envioPorId(id)
  if (!envio) throw new AppError('Envío no encontrado.', 404)
  if (envio.estado !== 'pendiente') throw new AppError('Este envío ya está resuelto.')
  const empresaId = Number(idDe(envio.empresa))
  const momento = ahora()
  if (data.estado === 'rechazado') {
    if (!data.motivoRechazo) throw new AppError('Indique el motivo del rechazo.')
    await ejecutar(`UPDATE envios SET estado='rechazado', motivo_rechazo=$2, resuelto_por_id=$3, resuelto_en=$4, updated_at=$4 WHERE id=$1`, [Number(id), data.motivoRechazo, ctx.user?.id ?? null, momento])
  } else {
    let destino = data.documentoDestino || null
    if (destino) {
      const d = await documentoPorId(destino)
      if (!d || String(idDe(d.empresa)) !== String(empresaId)) throw new AppError('El documento de destino es de otra empresa.')
    } else {
      if (!data.categoriaDestino) throw new AppError('Elija el documento donde publicar o la instalación del documento nuevo.')
      const c = await categoriaPorId(data.categoriaDestino)
      if (!c || String(idDe(c.empresa)) !== String(empresaId)) throw new AppError('La instalación es de otra empresa.')
    }
    await ejecutar(
      `UPDATE envios SET estado='publicado', documento_destino_id=$2, categoria_destino_id=$3, titulo_final=$4, relacion_final=$5, fecha_emision=$6, fecha_caducidad=$7, fecha_aviso=$8, resuelto_por_id=$9, resuelto_en=$10, updated_at=$10 WHERE id=$1`,
      [Number(id), destino, data.categoriaDestino ?? null, data.tituloFinal ?? null, data.relacionFinal ?? null, data.fechaEmision ?? null, data.fechaCaducidad ?? null, data.fechaAviso ?? null, ctx.user?.id ?? null, momento],
    )
    const fresco = (await envioPorId(id))!
    if (!destino) {
      const nuevo = await crearDocumento(ctx, {
        titulo: fresco.tituloFinal?.trim() || fresco.titulo,
        empresa: empresaId,
        categoria: Number(data.categoriaDestino),
        fechaEmision: fresco.fechaEmision,
        fechaCaducidad: fresco.fechaCaducidad,
        fechaAviso: fresco.fechaAviso,
      })
      destino = nuevo.id
      await ejecutar('UPDATE envios SET documento_destino_id = $2 WHERE id = $1', [Number(id), destino])
    }
    const relacion = fresco.relacionFinal?.trim() || (data.documentoDestino ? fresco.relacion || 'Renovación' : 'Original')
    const caducidad = data.documentoDestino ? fresco.fechaCaducidad || fresco.nuevaCaducidad : undefined
    const binario = await leerFichero('envios', fresco)
    ctx.context.sinComprimir = true
    const publicado = await crearArchivo(
      ctx,
      { documento: destino, relacion, nuevaCaducidad: caducidad, nuevoAviso: data.documentoDestino ? fresco.fechaAviso : undefined, comentario: `Publicado desde el envío «${fresco.titulo}»${fresco.comentario ? `: ${fresco.comentario}` : ''}` },
      { data: binario, name: fresco.filename || 'archivo', mimetype: fresco.mimeType || 'application/octet-stream', size: binario.length },
      { sinComprimir: true },
    )
    // Si el envío salió de un adjunto de una conversación, el archivo publicado queda enlazado a ella.
    if (publicado) await enlazarArchivoDeEnvio(Number(id), Number(publicado.id))
  }
  const empresa = await empresaPorId(empresaId)
  const autorId = idDe(envio.enviadoPor)
  const autor = autorId ? await uno<{ id: number; email: string }>('SELECT id, email FROM users WHERE id = $1', [autorId]) : null
  if (data.estado === 'rechazado') {
    await registrar(ctx, { accion: 'rechazo', descripcion: `Rechazado el envío «${envio.titulo}»: ${data.motivoRechazo}`, empresa: empresaId, coleccion: 'envios', registroId: envio.id })
    if (autor && empresa) {
      await programarCorreo(ctx, {
        plantilla: 'envio_rechazado',
        para: [{ email: autor.email, usuario: autor.id, tipo: 'cliente' }],
        vars: { documento: envio.titulo, motivo: data.motivoRechazo, empresa: empresa.razonSocial },
        enlace: `${urlServidor()}/portal/documentos?empresa=${empresa.id}`,
        empresa: empresa.id,
      })
    }
  } else {
    const destino = data.documentoDestino || (await uno<{ documento_destino_id: number }>('SELECT documento_destino_id FROM envios WHERE id = $1', [Number(id)]))?.documento_destino_id
    await registrar(ctx, { accion: 'publicacion', descripcion: `Publicado el envío «${envio.titulo}»`, empresa: empresaId, coleccion: 'envios', registroId: envio.id })
    if (autor && empresa) {
      await programarCorreo(ctx, {
        plantilla: 'envio_publicado',
        para: [{ email: autor.email, usuario: autor.id, tipo: 'cliente' }],
        vars: { documento: envio.titulo, empresa: empresa.razonSocial },
        enlace: `${urlServidor()}/portal/documentos/${destino}`,
        empresa: empresa.id,
        documento: destino,
      })
    }
  }
  return envioPorId(id)
}

export async function crearEmpresa(
  ctx: Ctx,
  data: { razonSocial: string; cif: string; direccion?: string; sector?: string; contacto?: string; emailsAviso?: { email: string }[]; gestion?: Empresa['gestion']; antelacionMeses?: number | null; adminEmail?: string; adminNombre?: string; aplicarPlantilla?: boolean },
) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC puede dar de alta empresas.', 403)
  if (!data.adminEmail) throw new AppError('Indique el email del administrador de la empresa.')
  const momento = ahora()
  const row = await uno<{ id: number }>(
    `INSERT INTO empresas (razon_social, cif, direccion, sector, contacto, gestion, antelacion_meses, activa, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) RETURNING id`,
    [data.razonSocial.trim(), data.cif.trim().toUpperCase(), data.direccion ?? null, data.sector ?? null, data.contacto ?? null, data.gestion ?? null, data.antelacionMeses ?? null, bit(true), momento],
  )
  let orden = 1
  for (const e of data.emailsAviso ?? []) {
    if (!e.email) continue
    await ejecutar('INSERT INTO empresas_emails_aviso (id, _order, _parent_id, email) VALUES ($1,$2,$3,$4)', [crypto.randomUUID(), orden++, row!.id, e.email])
  }
  const empresa = (await empresaPorId(row!.id))!
  await registrar(ctx, { accion: 'alta', descripcion: `Alta de la empresa «${empresa.razonSocial}»`, empresa: empresa.id, coleccion: 'empresas', registroId: empresa.id })
  if (data.aplicarPlantilla !== false) {
    const cfg = await leerConfiguracion()
    let o = 0
    for (const c of cfg.plantillaCategorias) {
      await ejecutar(
        `INSERT INTO categorias (nombre, empresa_id, descripcion, antelacion_meses, gestion, orden, archivada, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)`,
        [c.nombre, empresa.id, c.descripcion ?? null, c.antelacionMeses ?? null, c.gestion || null, o++, bit(false), momento],
      )
      await usarNombre(ctx, 'categoria', c.nombre)
    }
  }
  const { invitarUsuario } = await import('@/servicios/usuarios')
  await invitarUsuario(ctx, { email: data.adminEmail, nombre: data.adminNombre, empresa: empresa.id, rol: 'admin' })
  return empresa
}

const GESTION = (g?: string | null) => (g === 'gestionado' ? 'gestionado' : g === 'no_gestionado' ? 'no gestionado' : 'heredada')

export async function actualizarEmpresa(ctx: Ctx, id: number | string, data: { antelacionMeses?: number | null; activa?: boolean; gestion?: Empresa['gestion'] | null }) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC puede editar empresas.', 403)
  const antes = await empresaPorId(id)
  if (!antes) throw new AppError('Empresa no encontrada.', 404)
  const momento = ahora()
  if (data.antelacionMeses !== undefined) await ejecutar('UPDATE empresas SET antelacion_meses = $2, updated_at = $3 WHERE id = $1', [Number(id), data.antelacionMeses, momento])
  if (data.activa !== undefined) await ejecutar('UPDATE empresas SET activa = $2, updated_at = $3 WHERE id = $1', [Number(id), bit(data.activa), momento])
  if (data.gestion !== undefined) await ejecutar('UPDATE empresas SET gestion = $2, updated_at = $3 WHERE id = $1', [Number(id), data.gestion, momento])
  const despues = (await empresaPorId(id))!
  if (antes.activa !== despues.activa) {
    await registrar(ctx, { accion: despues.activa ? 'alta' : 'baja', descripcion: `${despues.activa ? 'Reactivación' : 'Baja lógica'} de la empresa «${despues.razonSocial}»`, empresa: despues.id, coleccion: 'empresas', registroId: despues.id })
  }
  const cambios = [
    antes.antelacionMeses !== despues.antelacionMeses && `antelación de aviso ${antes.antelacionMeses ?? 'estándar'} → ${despues.antelacionMeses ?? 'estándar'} meses`,
    antes.gestion !== despues.gestion && `modalidad ${GESTION(antes.gestion)} → ${GESTION(despues.gestion)}`,
  ].filter(Boolean)
  if (cambios.length) {
    await registrar(ctx, { accion: 'edicion', descripcion: `Empresa «${despues.razonSocial}»: ${cambios.join('; ')}`, empresa: despues.id, coleccion: 'empresas', registroId: despues.id, datos: { antes: { antelacionMeses: antes.antelacionMeses, gestion: antes.gestion }, despues: { antelacionMeses: despues.antelacionMeses, gestion: despues.gestion } } })
  }
  return despues
}

export async function actualizarCategoria(ctx: Ctx, id: number | string, data: { antelacionMeses?: number | null; gestion?: string | null; nombre?: string; archivada?: boolean }) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC puede editar instalaciones.', 403)
  const antes = await categoriaPorId(id)
  if (!antes) throw new AppError('Instalación no encontrada.', 404)
  const momento = ahora()
  if (data.antelacionMeses !== undefined) await ejecutar('UPDATE categorias SET antelacion_meses = $2, updated_at = $3 WHERE id = $1', [Number(id), data.antelacionMeses, momento])
  if (data.gestion !== undefined) await ejecutar('UPDATE categorias SET gestion = $2, updated_at = $3 WHERE id = $1', [Number(id), data.gestion, momento])
  if (data.nombre !== undefined) await ejecutar('UPDATE categorias SET nombre = $2, updated_at = $3 WHERE id = $1', [Number(id), data.nombre, momento])
  if (data.archivada !== undefined) await ejecutar('UPDATE categorias SET archivada = $2, updated_at = $3 WHERE id = $1', [Number(id), bit(data.archivada), momento])
  const despues = (await categoriaPorId(id))!
  const cambios = [
    antes.nombre !== despues.nombre && `nombre «${antes.nombre}» → «${despues.nombre}»`,
    antes.antelacionMeses !== despues.antelacionMeses && `antelación de aviso ${antes.antelacionMeses ?? 'de la empresa'} → ${despues.antelacionMeses ?? 'de la empresa'} meses`,
    antes.gestion !== despues.gestion && `modalidad ${GESTION(antes.gestion)} → ${GESTION(despues.gestion)}`,
    Boolean(antes.archivada) !== Boolean(despues.archivada) && (despues.archivada ? 'archivada' : 'desarchivada'),
  ].filter(Boolean)
  if (cambios.length) {
    await registrar(ctx, { accion: 'edicion', descripcion: `Instalación «${despues.nombre}»: ${cambios.join('; ')}`, empresa: idDe(despues.empresa), coleccion: 'categorias', registroId: despues.id })
  }
  return despues
}

export async function crearMedia(ctx: Ctx, alt: string, fichero: Fichero) {
  if (!esSuperAdmin(ctx.user)) throw new AppError('Solo CMC.', 403)
  const guardado = await guardarFichero('media', fichero)
  const momento = ahora()
  const row = await uno<{ id: number }>(
    `INSERT INTO media (alt, url, filename, mime_type, filesize, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING id`,
    [alt, guardado.url, guardado.filename, guardado.mimeType, guardado.filesize, momento],
  )
  return row!.id
}

export async function recalcularColor(ctx: Ctx, id: number) {
  const doc = await documentoPorId(id)
  if (!doc) return null
  const nuevo = calcularEstado(doc)
  if (nuevo === doc.estado) return doc
  await ejecutar('UPDATE documentos SET estado = $2, updated_at = $3 WHERE id = $1', [id, nuevo, ahora()])
  const actualizado = (await documentoPorId(id))!
  const empresa = typeof actualizado.empresa === 'object' ? actualizado.empresa : null
  if (empresa) {
    const cat = typeof actualizado.categoria === 'object' ? actualizado.categoria : null
    const manual = false
    // Caducidad próxima (amarillo) y caducado (rojo) ya los avisa la secuencia de la tarea nocturna (hitoDeHoy) el mismo día:
    // aquí solo se escribe por los demás cambios. Las empresas dadas de baja no reciben correos.
    const avisar = !ctx.context.sinAvisos && empresa.activa !== false && nuevo !== 'amarillo' && nuevo !== 'rojo'
    const gestionado = resolverGestion(empresa.gestion, cat?.gestion, actualizado.gestion) === 'gestionado'
    const antes = ESTADOS[doc.estado as Estado]?.label ?? '—'
    const despues = ESTADOS[nuevo].label
    const cierre = gestionado ? 'No necesita hacer nada: CMC lo gestiona y le avisaremos cuando el nuevo documento esté disponible.' : 'Revíselo y, cuando disponga del nuevo, súbalo al portal o envíenoslo.'
    if (avisar) await programarCorreo(ctx, {
      plantilla: gestionado ? 'proxima_gestionado' : 'proxima_no_gestionado',
      asunto: gestionado ? `«{{documento}}» pasa a ${despues} — CMC se encarga` : `«{{documento}}» pasa a ${despues} — requiere su revisión`,
      cuerpo: `El documento «{{documento}}» de {{empresa}} ha pasado de ${antes} a ${despues}. ${cierre}`,
      para: await destinatariosCliente(ctx, empresa),
      vars: { documento: actualizado.titulo, empresa: empresa.razonSocial },
      enlace: `${urlServidor()}/portal/documentos/${actualizado.id}`,
      empresa: empresa.id,
      documento: actualizado.id,
      idempotencia: `estado|${actualizado.id}|${doc.estado}|${nuevo}|||${actualizado.updatedAt}`,
    })
    await registrar(ctx, {
      accion: 'cambio_estado',
      descripcion: `«${actualizado.titulo}»: ${antes} → ${despues} (automático)`,
      empresa: empresa.id,
      coleccion: 'documentos',
      registroId: actualizado.id,
      datos: { antes: doc.estado, despues: nuevo, manual, motivo: 'Cálculo por fechas' },
    })
  }
  return actualizado
}
