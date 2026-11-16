/**
 * Datos iniciales: npm run seed
 * Crea el catálogo de tipos de relación, el super administrador de CMC y, salvo SEED_SIN_DEMO=1,
 * una empresa de ejemplo con su administradora, categorías y documentos en cada estado del semáforo.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { RELACIONES_INICIALES } from './lib/catalogo'

const enDias = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

const payload = await getPayload({ config })
const context = { sinInvitacion: true, sinAdminInicial: true, sinAvisos: true }

const yaHay = await payload.count({ collection: 'users' })
if (yaHay.totalDocs > 0) {
  payload.logger.info('La base de datos ya tiene usuarios; no se siembra nada.')
  process.exit(0)
}

for (const r of RELACIONES_INICIALES) {
  await payload.create({ collection: 'catalogo', data: { tipo: 'relacion', nombre: r.nombre, efectos: r.efectos }, context })
}

const password = process.env.SEED_PASSWORD || 'CambiarEsto2026'
const admin = await payload.create({
  collection: 'users',
  data: { email: process.env.SEED_ADMIN_EMAIL || 'admin@cmc.test', password, nombre: 'Técnico CMC', rol: 'superadmin', recibeAvisos: true },
  context,
})

if (process.env.SEED_SIN_DEMO !== '1') {
  const empresa = await payload.create({
    collection: 'empresas',
    data: { razonSocial: 'Empresa Demo, S.L.', cif: 'B00000000', direccion: 'Logroño', emailsAviso: [{ email: 'calidad@empresa-demo.test' }], activa: true, tecnico: admin.id, aplicarPlantilla: false } as never,
    context,
  })

  await payload.create({
    collection: 'users',
    data: { email: 'cliente@empresa-demo.test', password, nombre: 'Administradora Demo', rol: 'cliente', empresas: [{ empresa: empresa.id, rol: 'admin' }] },
    context,
  })

  const cat = async (nombre: string, antelacionMeses?: number, gestion?: 'gestionado') =>
    payload.create({ collection: 'categorias', data: { nombre, empresa: empresa.id, antelacionMeses, gestion }, context })

  const iso = await cat('Certificados ISO')
  const oca = await cat('Inspecciones OCA', 3, 'gestionado')
  const lic = await cat('Licencias')

  const docs = [
    { titulo: 'Certificado ISO 9001', categoria: iso.id, referencia: 'ES-QA-0001', fechaCaducidad: enDias(500) },
    { titulo: 'Certificado ISO 14001', categoria: iso.id, referencia: 'ES-EM-0001', fechaCaducidad: enDias(80) },
    { titulo: 'Inspección OCA baja tensión — Nave 2', categoria: oca.id, referencia: 'OCA-0001', fechaCaducidad: enDias(29) },
    { titulo: 'Licencia ambiental de actividad', categoria: lic.id, organismo: 'Ayuntamiento', fechaCaducidad: enDias(-46) },
    { titulo: 'Plan de autoprotección', categoria: lic.id, fechaCaducidad: enDias(400), estadoManual: 'amarillo' as const, motivoEstado: 'Pendiente de subsanar el plano de evacuación.' },
  ]
  for (const d of docs) await payload.create({ collection: 'documentos', data: { ...d, empresa: empresa.id }, context })
}

payload.logger.info(`Listo. Admin: admin@cmc.test · Cliente: cliente@empresa-demo.test · Contraseña: ${password}`)
process.exit(0)
