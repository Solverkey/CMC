/**
 * Datos iniciales: npm run seed
 *
 * 1. Si la base está vacía, crea todas las tablas (src/esquema/postgres.sql; en SQLite, traducido).
 * 2. Contenido de la web (servicios y trabajos), solo si aún no hay.
 * 3. Si no hay usuarios: catálogo de tipos de relación, super administrador de CMC y, salvo SEED_SIN_DEMO=1,
 *    una empresa de ejemplo con su administradora, instalaciones, documentos en cada color del semáforo y una conversación.
 *
 * Nunca borra ni modifica lo que ya existe. Variables: SEED_ADMIN_EMAIL, SEED_PASSWORD, SEED_SIN_DEMO.
 */
import 'dotenv/config'
import { RELACIONES_INICIALES, usarNombre } from '@/lib/catalogo'
import { crearHashPassword } from '@/lib/clave'
import { leerConfiguracion } from '@/lib/configuracion'
import { SERVICIOS_INICIALES, TRABAJOS_INICIALES } from '@/lib/contenidoWeb'
import { ctxSistema } from '@/lib/ctx'
import { ahora, bit, ejecutar, esPostgres, uno } from '@/lib/db'
import { asegurarLecturas } from '@/datos/consultas'
import { crearEsquema } from '@/lib/esquema'
import { calcularEstado, restarMeses, type EstadoManual } from '@/lib/estado'

const log = (t: string) => console.log(`· ${t}`)
const contar = async (tabla: string) => Number((await uno<{ n: number }>(`SELECT COUNT(*) AS n FROM ${tabla}`))?.n ?? 0)
const insertar = async (sql: string, params: unknown[]) => (await uno<{ id: number }>(`${sql} RETURNING id`, params))!.id
const enDias = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString()
const hace = (horas: number) => new Date(Date.now() - horas * 3_600_000).toISOString()
const idTexto = () => Math.random().toString(16).slice(2, 14).padEnd(12, '0')

async function main() {
  console.log(`Base de datos: ${esPostgres ? 'Postgres' : 'SQLite local'}`)
  if (await crearEsquema()) log('Esquema creado.')

  const momento = ahora()
  if (!(await contar('servicios'))) {
    for (const [i, s] of SERVICIOS_INICIALES.entries()) {
      const id = await insertar(
        'INSERT INTO servicios (titulo, area, resumen, enlace, texto_enlace, destacado, orden, publicado, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)',
        [s.titulo, s.area, s.resumen, s.enlace ?? null, s.textoEnlace ?? null, bit(Boolean(s.destacado)), (i + 1) * 10, bit(true), momento],
      )
      for (const [j, texto] of s.puntos.entries()) await ejecutar('INSERT INTO servicios_puntos (_order, _parent_id, id, texto) VALUES ($1,$2,$3,$4)', [j + 1, id, idTexto(), texto])
    }
    log(`Web: ${SERVICIOS_INICIALES.length} servicios.`)
  }
  if (!(await contar('trabajos'))) {
    for (const [i, t] of TRABAJOS_INICIALES.entries()) {
      await ejecutar('INSERT INTO trabajos (titulo, descripcion, cliente, lugar, area, orden, publicado, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8)', [t.titulo, t.descripcion ?? null, t.cliente ?? null, t.lugar ?? null, t.area, (i + 1) * 10, bit(true), momento])
    }
    log(`Web: ${TRABAJOS_INICIALES.length} trabajos realizados.`)
  }

  if (await contar('users')) {
    log('La base ya tiene usuarios: no se crean ni el administrador ni la empresa de ejemplo.')
    return
  }

  const ctx = { ...ctxSistema(), context: { origen: 'sistema', sinCatalogo: false } }
  for (const r of RELACIONES_INICIALES) await usarNombre(ctx, 'relacion', r.nombre, { efectos: r.efectos })
  log(`Catálogo: ${RELACIONES_INICIALES.length} tipos de relación.`)

  const password = process.env.SEED_PASSWORD || 'CambiarEsto2026'
  const usuario = async (email: string, nombre: string, rol: 'superadmin' | 'cliente') => {
    const { hash, salt } = await crearHashPassword(password)
    return insertar(
      'INSERT INTO users (email, nombre, rol, recibe_avisos, activo, totp_activo, hash, salt, login_attempts, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,$9,$9)',
      [email, nombre, rol, bit(true), bit(true), bit(false), hash, salt, momento],
    )
  }
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@cmc.test'
  const admin = await usuario(adminEmail, 'Técnico CMC', 'superadmin')
  log(`Super administrador: ${adminEmail}`)

  if (process.env.SEED_SIN_DEMO === '1') return finalizar(password, adminEmail)

  const empresa = await insertar(
    'INSERT INTO empresas (razon_social, cif, direccion, gestion, tecnico_id, activa, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)',
    ['Empresa Demo, S.L.', 'B00000000', 'Logroño', 'no_gestionado', admin, bit(true), momento],
  )
  await ejecutar('INSERT INTO empresas_emails_aviso (_order, _parent_id, id, email) VALUES (1,$1,$2,$3)', [empresa, idTexto(), 'calidad@empresa-demo.test'])
  const cliente = await usuario('cliente@empresa-demo.test', 'Administradora Demo', 'cliente')
  await ejecutar('INSERT INTO users_empresas (_order, _parent_id, id, empresa_id, rol) VALUES (1,$1,$2,$3,$4)', [cliente, idTexto(), empresa, 'admin'])

  const instalacion = (nombre: string, antelacionMeses: number | null, gestion: 'gestionado' | null, orden: number) =>
    insertar('INSERT INTO categorias (nombre, empresa_id, antelacion_meses, gestion, orden, archivada, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$7)', [nombre, empresa, antelacionMeses, gestion, orden, bit(false), momento])
  const alta = await instalacion('Alta tensión', null, null, 10)
  const baja = await instalacion('Baja tensión', 3, 'gestionado', 20)
  for (const n of ['Alta tensión', 'Baja tensión']) await usarNombre(ctx, 'categoria', n)

  const cfg = await leerConfiguracion()
  const docs: { titulo: string; categoria: number; meses: number; referencia?: string; organismo?: string; caducidad: string; manual?: EstadoManual; motivo?: string }[] = [
    { titulo: 'Inspección de alta tensión', categoria: alta, meses: cfg.antelacionMeses, referencia: 'AT-0001', caducidad: enDias(500) },
    { titulo: 'Centro de transformación', categoria: alta, meses: cfg.antelacionMeses, referencia: 'AT-0002', caducidad: enDias(50) },
    { titulo: 'Inspección de baja tensión — Nave 2', categoria: baja, meses: 3, referencia: 'BT-0001', caducidad: enDias(29) },
    { titulo: 'Cuadro eléctrico de baja tensión', categoria: baja, meses: 3, organismo: 'Organismo de control', caducidad: enDias(-46) },
    { titulo: 'Instalación de baja tensión — Oficina', categoria: baja, meses: 3, caducidad: enDias(400), manual: 'naranja', motivo: 'Pendiente de subsanar el plano de evacuación.' },
  ]
  let primero = 0
  for (const d of docs) {
    const aviso = restarMeses(new Date(d.caducidad), d.meses).toISOString()
    const estado = calcularEstado({ fechaCaducidad: d.caducidad, fechaAviso: aviso, estadoManual: d.manual })
    const id = await insertar(
      'INSERT INTO documentos (titulo, empresa_id, categoria_id, referencia, organismo, fecha_caducidad, fecha_aviso, estado, estado_manual, motivo_estado, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11)',
      [d.titulo, empresa, d.categoria, d.referencia ?? null, d.organismo ?? null, d.caducidad, aviso, estado, d.manual ?? null, d.motivo ?? null, momento],
    )
    await usarNombre(ctx, 'documento', d.titulo)
    primero ||= id
  }
  log(`Empresa de ejemplo con ${docs.length} documentos.`)

  // Una conversación de ejemplo para ver Comunicación. Se fija el inicio de las lecturas antes de ella para que salga sin leer.
  await asegurarLecturas()
  await ejecutar('UPDATE hilos_lecturas SET leido_en = $1 WHERE hilo_id = 0 AND usuario_id = 0', [hace(48)])
  const mensajes: [number, string, number][] = [
    [cliente, '¿Cuándo tenéis previsto renovar la inspección de baja tensión de la nave 2? Nos ha llegado el aviso.', 26],
    [admin, 'La tenemos programada para la semana que viene. Le avisaremos en cuanto el organismo emita el acta.', 2],
  ]
  const hilo = await insertar(
    "INSERT INTO hilos (asunto, empresa_id, documento_id, estado, asignado_id, creado_por_id, ultimo_mensaje, updated_at, created_at) VALUES ($1,$2,$3,'abierto',$4,$5,$6,$6,$7)",
    ['Renovación de la inspección de baja tensión', empresa, primero + 2, admin, cliente, hace(2), hace(26)],
  )
  for (const [autor, texto, horas] of mensajes) await ejecutar('INSERT INTO mensajes (hilo_id, texto, empresa_id, autor_id, updated_at, created_at) VALUES ($1,$2,$3,$4,$5,$5)', [hilo, texto, empresa, autor, hace(horas)])
  log('Una conversación de ejemplo.')

  finalizar(password, adminEmail, 'cliente@empresa-demo.test')
}

function finalizar(password: string, ...emails: string[]) {
  console.log(`Listo. Usuarios: ${emails.join(' · ')} · Contraseña: ${password}`)
  if (!process.env.CMC_2FA_SUPERADMIN) console.log('Recuerde: el super administrador debe activar el doble factor al entrar (o defina CMC_2FA_SUPERADMIN=opcional en local).')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
