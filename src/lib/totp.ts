import crypto from 'crypto'

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PASO = 30

export function base32(buf: Buffer) {
  let bits = 0
  let valor = 0
  let salida = ''
  for (const byte of buf) {
    valor = (valor << 8) | byte
    bits += 8
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31]
  return salida
}

function desdeBase32(s: string) {
  const limpio = s.replace(/=+$/, '').replace(/\s/g, '').toUpperCase()
  let bits = 0
  let valor = 0
  const bytes: number[] = []
  for (const c of limpio) {
    const i = ALFABETO.indexOf(c)
    if (i < 0) continue
    valor = (valor << 5) | i
    bits += 5
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export const nuevoSecreto = () => base32(crypto.randomBytes(20))

export function codigo(secreto: string, paso: number) {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(paso))
  const h = crypto.createHmac('sha1', desdeBase32(secreto)).update(contador).digest()
  const o = h[h.length - 1] & 15
  const n = (h.readUInt32BE(o) & 0x7fffffff) % 1_000_000
  return n.toString().padStart(6, '0')
}

/** Devuelve el paso aceptado (±1 de margen) o null. Un paso ya usado no se acepta dos veces. */
export function verificar(secreto: string, entrada: string, ultimoPaso?: number | null, ahora = Date.now()) {
  const limpio = entrada.replace(/\s/g, '')
  if (!/^\d{6}$/.test(limpio)) return null
  const actual = Math.floor(ahora / 1000 / PASO)
  for (const p of [actual, actual - 1, actual + 1]) {
    if (ultimoPaso && p <= ultimoPaso) continue
    if (crypto.timingSafeEqual(Buffer.from(codigo(secreto, p)), Buffer.from(limpio))) return p
  }
  return null
}

export const uriOtpauth = (secreto: string, email: string) =>
  `otpauth://totp/${encodeURIComponent(`CMC:${email}`)}?secret=${secreto}&issuer=CMC&algorithm=SHA1&digits=6&period=${PASO}`
