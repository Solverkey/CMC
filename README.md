# CMC · Web y portal documental

Web pública de CMC y portal documental en **Next.js 16** con SQL directo (Postgres de Supabase en producción, SQLite en local). El portal sigue el *Informe funcional — Portal documental CMC v1.0* (Solverkey).

## Web pública

| URL | Contenido | Se edita en |
|---|---|---|
| `/` | Portada, áreas, servicios destacados, portal documental, trabajos y clientes | Web → Web (portada), Servicios (destacado), Trabajos realizados |
| `/servicios` | Servicios agrupados por área: calidad, medio ambiente y gestión | Web → Servicios |
| `/trabajos` | Trabajos realizados, con filtro por área | Web → Trabajos realizados |
| `/quienes-somos` | Presentación y equipo | Web → Web (Quiénes somos) |
| `/contacto` | Sedes y formulario de consulta | Web → Web (Contacto) |
| `/aviso-legal`, `/privacidad`, `/cookies` | Textos legales | Web → Web (Textos legales) |

> **Pendiente:** «Se edita en» se refiere al panel de Payload, que se retiró. Hoy no hay pantalla para editar la web ni para ver las consultas del formulario: los textos están en las tablas `web`, `servicios` y `trabajos` (lo vacío usa los textos de partida), y cada consulta se guarda en `consultas` y llega por correo.

- El contenido de partida (servicios, trabajos, sedes y presentación) es el de la web actual de CMC. Lo que se deja vacío en el panel usa esos textos.
- **Formulario de contacto:**
  - Guarda la consulta en Web → Consultas de la web.
  - Avisa por correo a los destinatarios configurados (o a los super administradores), con respuesta directa al remitente.
  - Queda en el registro de actividad.
  - Contra el spam: campo trampa, envío mínimo a los 3 segundos de cargar la página y un máximo de 5 consultas por hora e IP.
- **Antes de publicar:** rellene en Web → Textos legales el CIF y los datos registrales del titular. Los textos por defecto no los inventan.
- **Buscadores:** la web se indexa, con `sitemap.xml`, `robots.txt` y datos estructurados. El portal, el panel y la API llevan `noindex`.

## Arrancar en local

```bash
cp .env.example .env        # cambie PAYLOAD_SECRET; en local añada CMC_2FA_SUPERADMIN=opcional
npm install
npm run seed                # crea las tablas si la base está vacía y carga la web, el catálogo, el administrador y una empresa de demo
npm run dev                 # http://localhost:3000
```

En local la base de datos es SQLite (`cmc.db`), los archivos se guardan en `./uploads` y los correos se muestran en la consola.
`npm run seed` crea el esquema a partir de `src/esquema/postgres.sql` (en SQLite lo traduce `src/lib/esquema.ts`) y no toca una base que ya tenga tablas ni usuarios. También sirve contra un Postgres vacío.
Usuarios del seed (contraseña `CambiarEsto2026` o `SEED_PASSWORD`): `admin@cmc.test` (CMC) y `cliente@empresa-demo.test` (administradora de la empresa de demo).

## Producción

Todo se activa por variables de entorno (ver `.env.example`):

| Pieza | Variable | Qué hace |
|---|---|---|
| Base de datos | `DATABASE_URL=postgres://…` | Postgres en un servidor de la UE (Supabase). Al conectar se cierra la API REST pública de Supabase en todas las tablas (`src/lib/cerrarApi.ts`). |
| Archivos | `S3_BUCKET`, `S3_ENDPOINT`… | Cubo privado de Supabase Storage. El portal lee el fichero y lo muestra; la descarga va en el botón. |
| Correo | `SMTP_HOST`, `EMAIL_FROM`… | Envío por SMTP con el dominio de CMC (configure SPF, DKIM y DMARC en el DNS). |
| Seguimiento de correo | `EMAIL_WEBHOOK_SECRET` | Webhook `POST /api/correos/eventos` (cabecera `x-webhook-secret` o `?secreto=`) para entregado, abierto y rebotado; admite los formatos de Resend, Postmark y SendGrid. La apertura también se detecta con un píxel. |
| Dirección pública | `NEXT_PUBLIC_SERVER_URL` | Enlaces de los correos, descargas y OAuth del servidor MCP. Opcional en Vercel: sin ella se usa la dirección de producción del proyecto (`VERCEL_PROJECT_PRODUCTION_URL`). Póngala al usar un dominio propio. |

El doble factor es obligatorio para los super administradores salvo que `CMC_2FA_SUPERADMIN=opcional` esté definida; en producción solo debe usarse de forma temporal. Ejecute `npm run seed` una vez contra la base de producción para cargar el contenido inicial de la web (con `SEED_SIN_DEMO=1` para no crear la empresa de demo). Ya no hay migraciones automáticas: un cambio del modelo de datos se aplica con SQL en Supabase y se añade a `src/esquema/postgres.sql`. Las tablas pequeñas que el código crea solas cuando faltan (`hilos_lecturas`, para leídos y no leídos de Comunicación) no necesitan nada.

## Qué hay en el portal

| URL | Qué es | Requisito |
|---|---|---|
| `/portal` | Panel con semáforo y vencimientos a 30, 60 y 90 días; vista consolidada multiempresa y panel de CMC por empresa | RF-14, RF-15 |
| `/portal/documentos` | Buscador con filtros, descarga en ZIP y exportación del inventario a Excel o PDF | RF-09, RF-16, RF-19 |
| `/portal/documentos/:id` | Ficha, archivo vigente, histórico, conversaciones y envío de renovaciones | RF-05, RF-08 |
| `/portal/enviar` | Envío a CMC (cliente) y bandeja de revisión (CMC) | RF-25 |
| `/portal/mensajes` | **Comunicación**, como un correo: conversaciones a la izquierda y mensajes a la derecha, con adjuntos, estado, asignación, búsqueda en los mensajes y exportación. Cada persona ve qué conversaciones tienen mensajes sin leer (el menú las cuenta) y cuáles esperan su respuesta | RF-26 |
| `/portal/avisos` | Avisos programados y correos enviados, con su estado de entrega | RF-17, RF-18 |
| `/portal/usuarios` | El administrador de empresa invita, cambia roles y retira accesos | RF-03, RF-04 |
| `/portal/actividad` | Registro de actividad inalterable (también lo hecho desde la IA) | RF-20 |
| `/portal/almacenamiento` | Espacio usado, por empresa, y aviso al acercarse al límite | RF-23 |
| `/portal/asistentes` | Conexión de asistentes de IA (MCP) y revocación de accesos | RF-27 |
| `/portal/seguridad` | Doble factor y contraseña | RF-01 |
| `/portal/selectores`, `/portal/configuracion` | CMC: catálogos de nombres (instalaciones, documentos y tipos de relación con su efecto) y **Configuración** global (avisos, plantillas de correo, imágenes, almacenamiento, plantilla de categorías) | RF-06, RF-21, RF-22, RF-28 |


## Permisos por rol en el portal

| | Usuario de empresa | Administrador de empresa | CMC |
|---|---|---|---|
| Panel, documentos, Comunicación, avisos | Sus empresas | Sus empresas | Todas |
| Usuarios, registro de actividad, facturación | — | Las empresas que administra | Todo |
| Bandeja de envíos, selectores, configuración, almacenamiento | — | — | Sí |

Los clientes no ven los documentos archivados (azul) en la búsqueda, el ZIP ni el inventario. Los archivos (`/api/ficheros/…`) solo se sirven con sesión y acceso a su empresa; los enlaces temporales del asistente de IA (10 minutos) vuelven a comprobar los permisos al descargar, pero funcionan para quien tenga el enlace durante ese tiempo.
Cambiar la contraseña pide la actual y cierra las demás sesiones; restablecerla las cierra todas. Con el doble factor activo, cambiar de aplicación pide un código de la actual. Los códigos erróneos cuentan para el bloqueo de 15 minutos.

## Servidor MCP (RF-27)

Dirección: `https://<portal>/api/mcp`. El asistente se autoriza con OAuth 2.1 + PKCE: el usuario entra en el portal y acepta. También se puede crear una clave manual en `/portal/asistentes`.
El asistente actúa siempre con los permisos del usuario, pide confirmación (`confirmar=true`) para las acciones importantes y todo queda en el registro con origen «Asistente de IA».
Las herramientas están en `src/mcp/herramientas.ts` y usan los mismos servicios que el portal (`src/servicios`).

Cada herramienta declara quién puede usarla, y el servidor solo enseña (`tools/list`) y deja ejecutar las del rol del usuario:

| Rol | Qué puede hacer su asistente |
|---|---|
| Usuario de empresa | Consultar sus empresas, resumen del panel, documentos, vencimientos, avisos, categorías, envíos y conversaciones (con adjuntos); descargar; enviar documentos a CMC y escribir mensajes |
| Administrador de empresa | Lo anterior, más usuarios de sus empresas (alta, rol, baja) y registro de actividad de las empresas que administra |
| CMC (super administrador con doble factor) | Todo: empresas, categorías, documentos, archivos, bandeja de envíos, estados, modalidad de gestión, conversaciones de todas las empresas y almacenamiento |

Además, cada servicio vuelve a comprobar el acceso a la empresa concreta. El transporte es *Streamable HTTP* sin SSE (versiones del protocolo 2025-06-18, 2025-03-26 y 2024-11-05). `quien_soy` devuelve el rol y las herramientas disponibles.

## Estructura

- `src/datos`: tipos, consultas y operaciones en SQL (empresas, usuarios, categorías, documentos, archivos, envíos, conversaciones, catálogo, correos, actividad). `src/lib/db.ts` habla con Postgres o SQLite.
- `src/access`: aislamiento por empresa, que se aplica siempre en el servidor.
- `src/servicios`: operaciones compartidas por el portal, la API y el MCP.
- `src/mcp`: servidor MCP (herramientas por rol, claves y OAuth).
- `src/esquema/postgres.sql` y `scripts/seed.ts`: esquema completo y datos iniciales (`npm run seed`).
- `src/components/comunicacion`: bandeja de Comunicación.
- `src/jobs`: recálculo nocturno de estados y avisos (03:00), resumen semanal (lunes 07:00) y cola de correos con reintentos.
- `src/lib/estado.ts` y `src/lib/avisos.ts`: semáforo y secuencia de recordatorios.

## Pruebas

```bash
npm run test:int     # lógica, aislamiento entre empresas, permisos y doble factor (base de datos aparte)
npm run test:e2e     # navegador: web pública, contacto, menú móvil y acceso (E2E_EMAIL y E2E_PASSWORD para la prueba con sesión)
npm run typecheck
```
