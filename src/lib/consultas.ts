import { crearTokenFirmado, leerTokenFirmado } from './cifrado'

const USO = 'consulta-web'

/** Token con la hora en que se cargó el formulario de contacto: descarta envíos automáticos instantáneos o muy antiguos. */
export const tokenFormulario = () => crearTokenFirmado({ t: Date.now() }, 60 * 60 * 24, USO)

export const leerTokenFormulario = (token: string) => leerTokenFirmado<{ t: number }>(token, USO)
