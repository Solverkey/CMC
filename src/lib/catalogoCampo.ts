/** Opción del desplegable para guardar un nombre que no está en el catálogo. */
export const opcionNueva = (nombre: string) => `Añadir «${nombre.trim()}»`

/** Si eligieron «Añadir «…»», devuelve el nombre; si no, el texto tal cual. */
export const nombreDeOpcion = (valor: string) => /^Añadir «([\s\S]+)»$/.exec(valor)?.[1] ?? valor
