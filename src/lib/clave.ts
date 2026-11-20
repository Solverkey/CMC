import crypto from 'crypto'

const PREFIJOS: Record<number, string> = {
  100000: 'pbkdf2-sha256-100k-v1:',
  600000: 'pbkdf2-sha256-v1:',
}
const ITERACIONES = 600000

const pbkdf2 = (password: string, salt: string, iterations: number, keyLength: number) =>
  new Promise<Buffer>((resolve, reject) => crypto.pbkdf2(password, salt, iterations, keyLength, 'sha256', (err, buf) => (err ? reject(err) : resolve(buf))))

const parametros = (hash: string) => {
  for (const [iter, prefijo] of Object.entries(PREFIJOS)) {
    if (hash.startsWith(prefijo)) return { hash: hash.slice(prefijo.length), iterations: Number(iter), keyLength: 32 }
  }
  return { hash, iterations: 25000, keyLength: 512 }
}

/** Misma comprobación que Payload: el hash guardado sigue valiendo. */
export async function verificarPassword(password: string, hash: string | null | undefined, salt: string | null | undefined) {
  if (!hash || !salt) return false
  const p = parametros(hash)
  const raw = await pbkdf2(password, salt, p.iterations, p.keyLength)
  const stored = Buffer.from(p.hash, 'hex')
  return raw.length === stored.length && crypto.timingSafeEqual(raw, stored)
}

export async function crearHashPassword(password: string) {
  const salt = crypto.randomBytes(32).toString('hex')
  const raw = await pbkdf2(password, salt, ITERACIONES, 32)
  return { salt, hash: `${PREFIJOS[ITERACIONES]}${raw.toString('hex')}` }
}

/** Secreto de 32 bytes que Payload deriva de PAYLOAD_SECRET para cifrar claves de API. */
export const secretoPayload = () => crypto.createHash('sha256').update(process.env.PAYLOAD_SECRET || '').digest('hex').slice(0, 32)

export const indiceClave = (clave: string) => crypto.createHmac('sha256', secretoPayload()).update(clave).digest('hex')

export function cifrarClaveApi(texto: string) {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-ctr', secretoPayload(), iv)
  return `${iv.toString('hex')}${cipher.update(texto, 'utf8', 'hex')}${cipher.final('hex')}`
}
