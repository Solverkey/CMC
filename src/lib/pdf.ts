import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

const EXTRA_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const limpiar = (s: string) =>
  [...s.replace(/→/g, '->').replace(/\t/g, ' ')].map((c) => (c.charCodeAt(0) <= 0xff || EXTRA_WINANSI.includes(c) ? c : '?')).join('')

type Columna = { titulo: string; ancho: number }

/** PDF A4 apaisado sencillo: título, subtítulo y tabla o bloques de texto con salto de página automático. */
export async function crearPdf(titulo: string, subtitulo: string) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(titulo)
  pdf.setProducer('Portal documental CMC')
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold)
  const [W, H] = [842, 595]
  const M = 40
  let page: PDFPage
  let y = 0
  let n = 0

  const nueva = () => {
    page = pdf.addPage([W, H])
    n++
    y = H - M
    page.drawText(limpiar(titulo), { x: M, y, size: 15, font: negrita, color: rgb(0.18, 0.24, 0.25) })
    y -= 18
    page.drawText(limpiar(subtitulo), { x: M, y, size: 9, font: normal, color: rgb(0.34, 0.38, 0.37) })
    page.drawText(`Página ${n}`, { x: W - M - 50, y: M / 2, size: 8, font: normal, color: rgb(0.34, 0.38, 0.37) })
    y -= 22
  }
  nueva()

  const partir = (texto: string, ancho: number, font: PDFFont, size: number) => {
    const out: string[] = []
    for (const parrafo of limpiar(texto).split('\n')) {
      let linea = ''
      for (const palabra of parrafo.split(' ')) {
        const prueba = linea ? `${linea} ${palabra}` : palabra
        if (font.widthOfTextAtSize(prueba, size) > ancho && linea) {
          out.push(linea)
          linea = palabra
        } else linea = prueba
      }
      out.push(linea)
    }
    return out
  }

  return {
    tabla(columnas: Columna[], filas: string[][]) {
      const size = 8.5
      const cab = () => {
        let x = M
        page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 16, color: rgb(0.94, 0.93, 0.88) })
        for (const c of columnas) {
          page.drawText(limpiar(c.titulo.toUpperCase()), { x: x + 3, y: y + 1, size: 7.5, font: negrita, color: rgb(0.34, 0.38, 0.37) })
          x += c.ancho
        }
        y -= 18
      }
      cab()
      for (const f of filas) {
        const celdas = f.map((t, i) => partir(t ?? '', columnas[i].ancho - 6, normal, size))
        const alto = Math.max(...celdas.map((c) => c.length)) * 11 + 4
        if (y - alto < M) {
          nueva()
          cab()
        }
        let x = M
        celdas.forEach((lineas, i) => {
          lineas.forEach((l, j) => page.drawText(l, { x: x + 3, y: y - j * 11, size, font: normal, color: rgb(0.12, 0.16, 0.17) }))
          x += columnas[i].ancho
        })
        y -= alto
        page.drawLine({ start: { x: M, y: y + 7 }, end: { x: W - M, y: y + 7 }, thickness: 0.4, color: rgb(0.86, 0.84, 0.76) })
      }
    },
    bloque(cabecera: string, texto: string) {
      const lineas = partir(texto, W - 2 * M, normal, 9.5)
      if (y - 14 - lineas.length * 12 < M) nueva()
      page.drawText(limpiar(cabecera), { x: M, y, size: 8.5, font: negrita, color: rgb(0.3, 0.38, 0.38) })
      y -= 13
      for (const l of lineas) {
        if (y < M) nueva()
        page.drawText(l, { x: M, y, size: 9.5, font: normal, color: rgb(0.12, 0.16, 0.17) })
        y -= 12
      }
      y -= 8
    },
    async guardar() {
      return Buffer.from(await pdf.save())
    },
  }
}
