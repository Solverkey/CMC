/**
 * Plantillas de correo por defecto (informe funcional, apartado 6). El super administrador las edita en
 * Administración → Configuración. Variables: {{empresa}} {{documento}} {{caducidad}} {{dias}} {{nombre}}
 * {{tecnico}} {{motivo}} {{asunto}} {{mensaje}} {{resumen}} {{uso}} {{limite}}.
 */
export type ClavePlantilla = keyof typeof PLANTILLAS

export type Plantilla = { etiqueta: string; asunto: string; cuerpo: string; boton?: string }

export const PLANTILLAS = {
  proxima_no_gestionado: {
    etiqueta: 'Caducidad próxima · No gestionado (cliente)',
    asunto: 'Su documento «{{documento}}» caduca el {{caducidad}} — requiere su revisión',
    cuerpo: 'Le informamos de que este documento caduca el {{caducidad}}. Revíselo y gestione su renovación; cuando disponga del nuevo documento, puede subirlo al portal o enviárnoslo.',
    boton: 'Ver documento',
  },
  proxima_gestionado: {
    etiqueta: 'Caducidad próxima · Gestionado por CMC (cliente)',
    asunto: 'Su documento «{{documento}}» caduca el {{caducidad}} — CMC se encarga',
    cuerpo: 'Le informamos de que este documento caduca el {{caducidad}}. No necesita hacer nada: CMC gestiona su renovación y le avisaremos cuando el nuevo documento esté disponible en el portal.',
    boton: 'Ver documento',
  },
  proxima_tecnico: {
    etiqueta: 'Caducidad próxima · Gestionado (técnico de CMC)',
    asunto: 'Iniciar renovación: «{{documento}}» de {{empresa}} caduca el {{caducidad}}',
    cuerpo: 'El documento «{{documento}}» de {{empresa}} está gestionado por CMC y caduca el {{caducidad}}. Inicie su renovación.',
    boton: 'Abrir documento',
  },
  recordatorio_no_gestionado: {
    etiqueta: 'Recordatorio 15 días antes · No gestionado (cliente)',
    asunto: 'Recordatorio: «{{documento}}» caduca en {{dias}} días',
    cuerpo: 'Todavía no hemos recibido la renovación de este documento, que caduca el {{caducidad}}. Cuando disponga del nuevo documento, súbalo al portal o envíenoslo.',
    boton: 'Enviar renovación',
  },
  recordatorio_tecnico: {
    etiqueta: 'Recordatorio 15 días antes · Gestionado (técnico de CMC)',
    asunto: 'Recordatorio: «{{documento}}» de {{empresa}} caduca en {{dias}} días',
    cuerpo: 'La renovación del documento «{{documento}}» de {{empresa}} sigue pendiente. Caduca el {{caducidad}}.',
    boton: 'Abrir documento',
  },
  caducado_no_gestionado: {
    etiqueta: 'Documento caducado · No gestionado (cliente y CMC)',
    asunto: 'El documento «{{documento}}» de {{empresa}} ha caducado',
    cuerpo: 'Este documento caducó el {{caducidad}} y ya no está vigente. Gestione su renovación lo antes posible y envíenos el nuevo documento desde el portal.',
    boton: 'Ver documento',
  },
  caducado_gestionado: {
    etiqueta: 'Documento caducado · Gestionado (cliente)',
    asunto: 'El documento «{{documento}}» ha caducado — CMC lo está tramitando',
    cuerpo: 'Este documento caducó el {{caducidad}}. No necesita hacer nada: CMC está tramitando su renovación y le avisaremos en cuanto el nuevo documento esté disponible.',
    boton: 'Ver documento',
  },
  caducado_tecnico: {
    etiqueta: 'Documento caducado · Gestionado (técnico y super administrador)',
    asunto: 'Caducado: «{{documento}}» de {{empresa}}',
    cuerpo: 'El documento «{{documento}}» de {{empresa}}, gestionado por CMC, caducó el {{caducidad}} sin renovación publicada.',
    boton: 'Abrir documento',
  },
  recordatorio_caducado_no_gestionado: {
    etiqueta: 'Recordatorio periódico mientras siga caducado · No gestionado',
    asunto: 'Sigue caducado: «{{documento}}» desde el {{caducidad}}',
    cuerpo: 'El documento «{{documento}}» continúa caducado desde el {{caducidad}}. Envíenos la renovación desde el portal en cuanto la tenga.',
    boton: 'Enviar renovación',
  },
  recordatorio_caducado_tecnico: {
    etiqueta: 'Recordatorio periódico mientras siga caducado · Gestionado (técnico)',
    asunto: 'Sigue caducado: «{{documento}}» de {{empresa}}',
    cuerpo: 'El documento «{{documento}}» de {{empresa}} continúa caducado desde el {{caducidad}}.',
    boton: 'Abrir documento',
  },
  renovacion_disponible: {
    etiqueta: 'Nuevo documento o renovación disponible',
    asunto: 'Nuevo documento disponible: «{{documento}}»',
    cuerpo: 'CMC ha publicado un nuevo archivo ({{tipo}}) en el documento «{{documento}}» de {{empresa}}.',
    boton: 'Ver documento',
  },
  resumen_semanal: {
    etiqueta: 'Resumen semanal para CMC',
    asunto: 'Resumen semanal: {{total}} documentos en amarillo o rojo',
    cuerpo: 'Documentos con caducidad próxima o caducados en todas las empresas:\n\n{{resumen}}',
    boton: 'Abrir panel',
  },
  invitacion: {
    etiqueta: 'Invitación y bienvenida',
    asunto: 'Le damos la bienvenida al portal documental de CMC',
    cuerpo: 'Hola, {{nombre}}. Se le ha dado acceso al portal documental de CMC para {{empresa}}. Pulse el botón para elegir su contraseña. El enlace caduca en 72 horas.',
    boton: 'Elegir contraseña',
  },
  acceso_empresa: {
    etiqueta: 'Acceso a una nueva empresa',
    asunto: 'Tiene acceso a {{empresa}} en el portal de CMC',
    cuerpo: 'Hola, {{nombre}}. Se le ha dado acceso a {{empresa}} en el portal documental de CMC. Puede elegirla en el selector de empresa al entrar.',
    boton: 'Entrar al portal',
  },
  recuperar_password: {
    etiqueta: 'Recuperación de contraseña',
    asunto: 'Restablecer su contraseña del portal de CMC',
    cuerpo: 'Hemos recibido una solicitud para restablecer su contraseña. Si no la ha hecho usted, ignore este correo. El enlace caduca en una hora.',
    boton: 'Restablecer contraseña',
  },
  envio_recibido: {
    etiqueta: 'Documento recibido de un cliente (CMC)',
    asunto: 'Nuevo envío de {{empresa}}: «{{documento}}»',
    cuerpo: '{{nombre}} ha enviado «{{documento}}» para su revisión.',
    boton: 'Revisar envío',
  },
  envio_publicado: {
    etiqueta: 'Documento publicado (usuario que lo envió)',
    asunto: 'Su envío «{{documento}}» se ha publicado',
    cuerpo: 'CMC ha revisado y publicado el documento que nos envió.',
    boton: 'Ver documento',
  },
  envio_rechazado: {
    etiqueta: 'Documento rechazado (usuario que lo envió)',
    asunto: 'Su envío «{{documento}}» no se ha publicado',
    cuerpo: 'CMC ha revisado el documento que nos envió y no lo ha publicado. Motivo: {{motivo}}',
    boton: 'Ver mis envíos',
  },
  nuevo_mensaje: {
    etiqueta: 'Nuevo mensaje',
    asunto: 'Nuevo mensaje en «{{asunto}}»',
    cuerpo: '{{nombre}} ha escrito en la conversación «{{asunto}}» de {{empresa}}:\n\n{{mensaje}}\n\nResponda desde el portal para que quede registrado.',
    boton: 'Responder en el portal',
  },
  consulta_web: {
    etiqueta: 'Nueva consulta desde la web (CMC)',
    asunto: 'Consulta de {{nombre}} desde la web',
    cuerpo: '{{nombre}} ({{empresa}}) ha escrito desde el formulario de contacto.\n\nCorreo: {{email}}\nTeléfono: {{telefono}}\nServicio: {{servicio}}\n\n{{mensaje}}',
    boton: 'Ver la consulta',
  },
  almacenamiento: {
    etiqueta: 'Aviso de almacenamiento',
    asunto: 'El portal ha consumido el {{uso}} % del almacenamiento incluido',
    cuerpo: 'El almacenamiento consumido es de {{consumido}} de {{limite}} incluidos. Superado ese volumen puede haber cargos adicionales.',
    boton: 'Ver consumo',
  },
} satisfies Record<string, Plantilla>
