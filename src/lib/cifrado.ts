import crypto from 'crypto'

const clave = (uso: string) => crypto.createHash('sha256').update(`${process.env.PAYLOAD_SECRET}:${uso}`).digest()

/** AES-256-GCM con una clave derivada de PAYLOAD_SECRET. */
export function cifrar(texto: string, uso = 'totp') {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', clave(uso), iv)
  const datos = Buffer.concat([c.update(texto, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), datos].map((b) => b.toString('base64url')).join('.')
}

export function descifrar(valor: string, uso = 'totp') {
  const [iv, tag, datos] = valor.split('.').map((p) => Buffer.from(p, 'base64url'))
  const d = crypto.createDecipheriv('aes-256-gcm', clave(uso), iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(datos), d.final()]).toString('utf8')
}

export const firmar = (texto: string, uso: string) => crypto.createHmac('sha256', clave(uso)).update(texto).digest('base64url')

export const hash = (texto: string) => crypto.createHash('sha256').update(texto).digest('hex')

export const tokenAleatorio = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')

export function igualSeguro(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

/** Token firmado y con caducidad: base64url(json).firma */
export function crearTokenFirmado(datos: object, segundos: number, uso: string) {
  const cuerpo = Buffer.from(JSON.stringify({ ...datos, exp: Math.floor(Date.now() / 1000) + segundos })).toString('base64url')
  return `${cuerpo}.${firmar(cuerpo, uso)}`
}

export function leerTokenFirmado<T>(token: string, uso: string): T | null {
  const [cuerpo, firma] = token.split('.')
  if (!cuerpo || !firma || !igualSeguro(firma, firmar(cuerpo, uso))) return null
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as T & { exp: number }
    return datos.exp >= Math.floor(Date.now() / 1000) ? datos : null
  } catch {
    return null
  }
}
