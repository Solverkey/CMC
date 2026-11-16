import type { DatosWeb } from './web'

export type PaginaLegal = 'avisoLegal' | 'privacidad' | 'cookies'

const identificacion = (w: DatosWeb) =>
  [`Titular: ${w.legal.titular}`, w.legal.cif && `CIF: ${w.legal.cif}`, `Domicilio: ${w.legal.domicilio}`, w.legal.registro, `Correo electrónico: ${w.email}`, `Teléfono: ${w.sedes[0]?.telefono ?? ''}`]
    .filter(Boolean)
    .join('\n')

/** Textos por defecto; el super administrador puede sustituirlos en Administración → Web → Textos legales. */
export function textoLegal(pagina: PaginaLegal, w: DatosWeb): string {
  const propio = w.textosLegales[pagina]
  if (propio?.trim()) return propio
  switch (pagina) {
    case 'avisoLegal':
      return `## Identificación del titular
En cumplimiento de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI-CE), se informa de los datos del titular de este sitio web:

${identificacion(w)}

## Objeto y condiciones de uso
Este sitio web informa sobre los servicios de consultoría de calidad y medio ambiente del titular y da acceso al portal documental de sus clientes. El acceso al portal está reservado a los usuarios autorizados, que son responsables de custodiar sus credenciales.

El usuario se compromete a hacer un uso adecuado de los contenidos y a no emplearlos para actividades ilícitas o contrarias a la buena fe.

## Propiedad intelectual
Los textos, diseños y logotipos de este sitio son propiedad del titular o se utilizan con autorización. No se permite su reproducción con fines comerciales sin autorización expresa.

## Responsabilidad
El titular no se hace responsable del mal uso de los contenidos ni de los daños derivados de interrupciones técnicas ajenas a su control. Los enlaces a sitios de terceros se ofrecen a título informativo.

## Legislación aplicable
Este aviso legal se rige por la legislación española.`
    case 'privacidad':
      return `## Responsable del tratamiento
${identificacion(w)}

## Qué datos tratamos y para qué
Formulario de contacto: nombre, empresa, correo electrónico, teléfono y el contenido de su consulta, para responderle y, en su caso, preparar una propuesta de servicios.

Portal documental: los datos de los usuarios autorizados por cada empresa cliente (nombre, correo electrónico, actividad en el portal) y la documentación que se gestiona, para prestar el servicio contratado, enviar los avisos de caducidad y mantener el registro de actividad que exige la seguridad de la información.

## Legitimación
Consultas: su consentimiento, que da al enviar el formulario. Portal: la ejecución del contrato de servicios con la empresa cliente y el interés legítimo en la seguridad de la plataforma.

## Conservación
Las consultas se conservan el tiempo necesario para atenderlas y, como máximo, un año si no dan lugar a una relación contractual. Los datos del portal se conservan mientras dure la relación con el cliente y, después, durante los plazos legales. El registro de actividad se conserva al menos dos años.

## Destinatarios
No se ceden datos a terceros salvo obligación legal. Los proveedores que alojan la plataforma y envían el correo actúan como encargados del tratamiento, con contrato y con los datos alojados en la Unión Europea.

## Sus derechos
Puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a ${w.email}. Si considera que no se han atendido correctamente, puede reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).`
    case 'cookies':
      return `## Qué cookies usamos
Esta web solo utiliza cookies técnicas, necesarias para su funcionamiento: la cookie de sesión del portal documental, que se crea al iniciar sesión y permite mantenerla abierta de forma segura.

No usamos cookies de análisis, de publicidad ni de terceros, por lo que no es necesario su consentimiento (artículo 22.2 de la LSSI-CE).

## Cómo desactivarlas
Puede borrar o bloquear las cookies desde la configuración de su navegador. Si bloquea la cookie de sesión no podrá acceder al portal.

## Cambios
Si en el futuro se incorporan otras cookies, se actualizará esta política y se pedirá su consentimiento antes de instalarlas.`
  }
}

export type Bloque = { tipo: 'titulo' | 'parrafo'; texto: string }

/** Convierte el texto plano editable en apartados («## ») y párrafos (separados por una línea en blanco). */
export function bloques(texto: string): Bloque[] {
  const out: Bloque[] = []
  for (const trozo of texto.split(/\n{2,}/)) {
    const lineas = trozo.split('\n')
    while (lineas[0]?.startsWith('## ')) out.push({ tipo: 'titulo', texto: lineas.shift()!.slice(3).trim() })
    const resto = lineas.join('\n').trim()
    if (resto) out.push({ tipo: 'parrafo', texto: resto })
  }
  return out
}
