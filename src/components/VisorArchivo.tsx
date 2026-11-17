/** Vista del archivo dentro de la ficha (RF-09). PDF e imágenes se ven en la página; Word y Excel se descargan. */
export function VisorArchivo({ url, nombre, mime }: { url: string; nombre: string; mime?: string | null }) {
  const tipo = (mime ?? '').toLowerCase()
  const archivo = nombre.toLowerCase()
  if (tipo === 'application/pdf' || archivo.endsWith('.pdf')) {
    return <iframe className="visor" src={url} title={`Vista previa de ${nombre}`} />
  }
  if (tipo.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(archivo)) {
    // eslint-disable-next-line @next/next/no-img-element -- el archivo puede venir de S3 y ya está comprimido
    return <img className="visor" src={url} alt={nombre} />
  }
  return <p className="muted">Word y Excel no se pueden mostrar aquí. Use Descargar para abrirlos.</p>
}
