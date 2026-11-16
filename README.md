# CMC · Web pública + Portal documental

Plantilla en **Next.js 16 + Payload CMS 3**, con el sistema de diseño de CMC. Basada en el *Informe funcional — Portal documental CMC v1.0*.

## Arrancar

```bash
cp .env.example .env        # y cambia PAYLOAD_SECRET
npm install
npm run seed                # datos de demo
npm run dev                 # http://localhost:3000
```

| URL | Qué es |
|---|---|
| `/` | Web pública (inicio, servicios, portal, clientes, contacto) |
| `/portal/login` | Acceso de clientes |
| `/portal` | Panel con semáforo, próximos vencimientos (30/60/90 días) y estado por categoría |
| `/portal/documentos/:id` | Ficha: datos, archivo vigente, histórico y envío de renovación |
| `/portal/enviar` | Envío de documentos a CMC y estado de los envíos |
| `/admin` | Panel de Payload, solo para CMC (super administrador) |

Usuarios de demo (contraseña `cambiar-esto`): `admin@cmc.test` (CMC) y `cliente@empresa-demo.test` (administradora de empresa).

## Modelo de datos (`src/collections`)

- **empresas**: clientes de CMC. Baja lógica (`activa`) y modalidad de gestión.
- **users**: rol global (`superadmin` / `cliente`) más `empresas[]` con un rol por empresa (multiempresa).
- **categorias**: por empresa, con su antelación de aviso propia.
- **documentos**: la «ficha». Al guardar se calculan `fechaAviso` (caducidad − antelación; 2 meses por defecto) y `estado`.
- **archivos** (upload): versiones y anexos de un documento. El tipo de relación es texto libre y sus efectos (sustituye, actualiza fechas, levanta condición, complementario) actualizan el documento. Nunca se borra nada: lo sustituido pasa a `historico`.
- **envios** (upload): bandeja de revisión. El cliente envía; CMC publica en un documento (se crea el archivo asociado) o rechaza con motivo.
- **media**: imágenes públicas y logotipos.

Toda la lógica del semáforo está en `src/lib/estado.ts`. Hay una tarea nocturna (`src/jobs/recalcularEstados.ts`, 03:00) que recalcula los estados.

## Seguridad ya incluida

- El aislamiento por empresa se aplica en el servidor (`src/access`). El portal consulta siempre con `overrideAccess: false`.
- Los archivos se sirven por `/api/archivos/file/...` con control de acceso: sin sesión devuelve 403.
- La cuenta se bloquea 15 minutos tras 5 intentos de acceso fallidos.
- Las imágenes se comprimen al subirlas: lado mayor de 2.500 px y formato WebP. Los PDF y los Office no se tocan.

Comprobado: build OK; login; un cliente no ve ni puede enviar a otra empresa; al publicar una renovación cambian las fechas y el estado; un JPG de 4000×3000 se guarda como WebP de 2500×1875.

## Pendiente (siguientes fases)

- [ ] Producción: `@payloadcms/db-postgres` y almacenamiento S3-compatible en la UE (`@payloadcms/storage-s3`), con cifrado en reposo.
- [ ] Correo (RF-17, RF-21): adaptador de email transaccional con dominio CMC (SPF/DKIM/DMARC), plantillas Gestionado / No gestionado y secuencia de recordatorios. El punto de enganche es el `TODO` de `recalcularEstados.ts`.
- [ ] 2FA (RF-01): obligatorio para super administradores.
- [ ] Gestión de usuarios desde el portal para el administrador de empresa (el control de acceso ya lo permite por API).
- [ ] Canal de comunicación (RF-26), registro de actividad (RF-20), informes Excel/PDF (RF-19), catálogos con autocompletado y deduplicación (RF-28).
- [ ] Servidor MCP (RF-27).
- [ ] HEIC: el `sharp` precompilado no decodifica HEIC; hace falta convertirlo en el cliente o usar libvips con libheif.
- [ ] Formulario de contacto de la web, páginas legales y logos reales de clientes.
- [ ] Recuperación de contraseña desde el portal: ahora enlaza a `/admin/forgot`.
