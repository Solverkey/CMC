# CMC · Web y portal documental

Web pública de CMC y portal documental en **Next.js 16 + Payload CMS 3**. El portal sigue el *Informe funcional — Portal documental CMC v1.0* (Solverkey).

## Web pública

| URL | Contenido | Se edita en |
|---|---|---|
| `/` | Portada, áreas, servicios destacados, portal documental, trabajos y clientes | Web → Web (portada), Servicios (destacado), Trabajos realizados |
| `/servicios` | Servicios agrupados por área: calidad, medio ambiente y gestión | Web → Servicios |
| `/trabajos` | Trabajos realizados, con filtro por área | Web → Trabajos realizados |
| `/quienes-somos` | Presentación y equipo | Web → Web (Quiénes somos) |
| `/contacto` | Sedes y formulario de consulta | Web → Web (Contacto) |
| `/aviso-legal`, `/privacidad`, `/cookies` | Textos legales | Web → Web (Textos legales) |

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
npm run seed                # contenido de la web, catálogo, super administrador y empresa de demo
npm run dev                 # http://localhost:3000
```

En local la base de datos es SQLite (`cmc.db`), los archivos se guardan en `./uploads` y los correos se muestran en la consola.
Usuarios del seed (contraseña `CambiarEsto2026` o `SEED_PASSWORD`): `admin@cmc.test` (CMC) y `cliente@empresa-demo.test` (administradora de la empresa de demo).

## Producción

Todo se activa por variables de entorno (ver `.env.example`):

| Pieza | Variable | Qué hace |
|---|---|---|
| Base de datos | `DATABASE_URL=postgres://…` | Postgres en un servidor de la UE. Al arrancar se aplican las migraciones de `src/migrations`. |
| Archivos | `S3_BUCKET`, `S3_REGION`… | S3 (o compatible) en la UE, privado, con enlaces de descarga temporales. |
| Correo | `SMTP_HOST`, `EMAIL_FROM`… | Envío por SMTP con el dominio de CMC (configure SPF, DKIM y DMARC en el DNS). |
| Seguimiento de correo | `EMAIL_WEBHOOK_SECRET` | Webhook `/api/correos/eventos` para entregado, abierto y rebotado. |
| Dirección pública | `NEXT_PUBLIC_SERVER_URL` | Enlaces de los correos y OAuth del servidor MCP. |

El doble factor es obligatorio para los super administradores salvo que `CMC_2FA_SUPERADMIN=opcional` esté definida; en producción solo debe usarse de forma temporal. Ejecute `npm run seed` una vez contra la base de producción para cargar el contenido inicial de la web (con `SEED_SIN_DEMO=1` para no crear la empresa de demo). Al cambiar el modelo de datos hay que crear una migración: `DATABASE_URL=postgres://… npm run migrate:create nombre`.

## Qué hay en el portal

| URL | Qué es | Requisito |
|---|---|---|
| `/portal` | Panel con semáforo y vencimientos a 30, 60 y 90 días; vista consolidada multiempresa y panel de CMC por empresa | RF-14, RF-15 |
| `/portal/documentos` | Buscador con filtros, descarga en ZIP y exportación del inventario a Excel o PDF | RF-09, RF-16, RF-19 |
| `/portal/documentos/:id` | Ficha, archivo vigente, histórico, conversaciones y envío de renovaciones | RF-05, RF-08 |
| `/portal/enviar` | Envío a CMC (cliente) y bandeja de revisión (CMC) | RF-25 |
| `/portal/mensajes` | Canal de comunicación por conversaciones, con adjuntos, estado, asignación y exportación | RF-26 |
| `/portal/avisos` | Avisos programados y correos enviados, con su estado de entrega | RF-17, RF-18 |
| `/portal/usuarios` | El administrador de empresa invita, cambia roles y retira accesos | RF-03, RF-04 |
| `/portal/actividad` | Registro de actividad inalterable (también lo hecho desde la IA) | RF-20 |
| `/portal/almacenamiento` | Espacio usado, por empresa, y aviso al acercarse al límite | RF-23 |
| `/portal/asistentes` | Conexión de asistentes de IA (MCP) y revocación de accesos | RF-27 |
| `/portal/seguridad` | Doble factor y contraseña | RF-01 |
| `/admin` | Panel de Payload para CMC: empresas, categorías, documentos, catálogos y la **Configuración** global (avisos, plantillas de correo, imágenes, almacenamiento, plantilla de categorías) | RF-06, RF-21, RF-22, RF-28 |

## Servidor MCP (RF-27)

Dirección: `https://<portal>/api/mcp`. El asistente se autoriza con OAuth 2.1 + PKCE: el usuario entra en el portal y acepta. También se puede crear una clave manual en `/portal/asistentes`.
El asistente actúa siempre con los permisos del usuario, pide confirmación (`confirmar=true`) para las acciones importantes y todo queda en el registro con origen «Asistente de IA».
Las herramientas están en `src/mcp/herramientas.ts` y usan los mismos servicios que el portal (`src/servicios`).

## Estructura

- `src/collections`: modelo de datos y reglas (empresas, usuarios, categorías, documentos, archivos, envíos, conversaciones, catálogo, correos, actividad).
- `src/access`: aislamiento por empresa, que se aplica siempre en el servidor.
- `src/servicios`: operaciones compartidas por el portal, la API y el MCP.
- `src/jobs`: recálculo nocturno de estados y avisos (03:00), resumen semanal (lunes 07:00) y cola de correos con reintentos.
- `src/lib/estado.ts` y `src/lib/avisos.ts`: semáforo y secuencia de recordatorios.

## Pruebas

```bash
npm run test:int     # lógica, aislamiento entre empresas, permisos y doble factor (base de datos aparte)
npm run test:e2e     # navegador: web pública, contacto, menú móvil y acceso (E2E_EMAIL y E2E_PASSWORD para la prueba con sesión)
npm run typecheck
```
