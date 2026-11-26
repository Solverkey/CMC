-- Esquema completo de la base de datos del portal (Postgres), reconstruido a partir de las migraciones de Payload
-- 20261116_155520_inicial, 20261116_161224_web, 20261117_* (valores del semáforo, ya incluidos en los tipos),
-- 20261119_102254_esquema_pendiente y 20261120_101900_antelacion_empresa.
-- Lo usa `npm run seed` para crear una base vacía (en SQLite se traduce en src/lib/esquema.ts).
-- Las tablas que el código crea solo cuando faltan (p. ej. hilos_lecturas) no están aquí.

-- 20261116_155520_inicial
CREATE TYPE "public"."enum_empresas_gestion" AS ENUM('gestionado', 'no_gestionado');
  CREATE TYPE "public"."enum_categorias_gestion" AS ENUM('gestionado', 'no_gestionado');
  CREATE TYPE "public"."enum_documentos_estado" AS ENUM('verde', 'amarillo', 'naranja', 'rojo', 'negro', 'azul');
  CREATE TYPE "public"."enum_documentos_estado_manual" AS ENUM('amarillo', 'rojo', 'negro', 'naranja', 'azul');
  CREATE TYPE "public"."enum_documentos_gestion" AS ENUM('gestionado', 'no_gestionado');
  CREATE TYPE "public"."enum_archivos_efectos" AS ENUM('sustituye', 'actualiza_fechas', 'levanta', 'complementario');
  CREATE TYPE "public"."enum_envios_estado" AS ENUM('pendiente', 'publicado', 'rechazado');
  CREATE TYPE "public"."enum_hilos_estado" AS ENUM('abierto', 'resuelto');
  CREATE TYPE "public"."enum_users_empresas_rol" AS ENUM('admin', 'usuario');
  CREATE TYPE "public"."enum_users_rol" AS ENUM('superadmin', 'cliente');
  CREATE TYPE "public"."enum_catalogo_efectos" AS ENUM('sustituye', 'actualiza_fechas', 'levanta', 'complementario');
  CREATE TYPE "public"."enum_catalogo_tipo" AS ENUM('categoria', 'documento', 'relacion');
  CREATE TYPE "public"."enum_correos_destinatario" AS ENUM('cliente', 'cmc');
  CREATE TYPE "public"."enum_correos_estado" AS ENUM('pendiente', 'enviado', 'entregado', 'abierto', 'rebotado', 'error');
  CREATE TYPE "public"."enum_actividad_accion" AS ENUM('login', 'login_fallido', 'logout', 'alta', 'edicion', 'baja', 'subida', 'descarga', 'cambio_estado', 'envio', 'publicacion', 'rechazo', 'mensaje', 'correo', 'correo_enviado', 'correo_entregado', 'correo_abierto', 'correo_rebotado', 'correo_error', 'permisos', 'seguridad', 'exportacion');
  CREATE TYPE "public"."enum_actividad_origen" AS ENUM('web', 'mcp', 'sistema');
  CREATE TYPE "public"."enum_payload_mcp_api_keys_origen" AS ENUM('oauth', 'manual');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'recalcularEstados', 'resumenSemanal', 'enviarCorreo');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'recalcularEstados', 'resumenSemanal', 'enviarCorreo');
  CREATE TYPE "public"."enum_configuracion_plantilla_categorias_gestion" AS ENUM('gestionado', 'no_gestionado');
  CREATE TYPE "public"."enum_configuracion_frecuencia_caducado" AS ENUM('semanal', 'mensual');
  CREATE TABLE "empresas_emails_aviso" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL
  );
  
  CREATE TABLE "empresas" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"razon_social" varchar NOT NULL,
  	"cif" varchar NOT NULL,
  	"direccion" varchar,
  	"sector" varchar,
  	"logo_id" integer,
  	"contacto" varchar,
  	"gestion" "enum_empresas_gestion",
  	"tecnico_id" integer,
  	"activa" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "categorias" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"nombre" varchar NOT NULL,
  	"empresa_id" integer NOT NULL,
  	"descripcion" varchar,
  	"antelacion_meses" numeric,
  	"gestion" "enum_categorias_gestion",
  	"responsable_id" integer,
  	"orden" numeric DEFAULT 0,
  	"archivada" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "documentos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"titulo" varchar NOT NULL,
  	"empresa_id" integer NOT NULL,
  	"categoria_id" integer NOT NULL,
  	"referencia" varchar,
  	"organismo" varchar,
  	"fecha_emision" timestamp(3) with time zone,
  	"fecha_caducidad" timestamp(3) with time zone,
  	"fecha_aviso" timestamp(3) with time zone,
  	"aviso_manual" boolean DEFAULT false,
  	"estado" "enum_documentos_estado",
  	"estado_manual" "enum_documentos_estado_manual",
  	"motivo_estado" varchar,
  	"limite_subsanacion" timestamp(3) with time zone,
  	"gestion" "enum_documentos_gestion",
  	"tecnico_id" integer,
  	"archivo_vigente_id" integer,
  	"observaciones" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "documentos_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "archivos_efectos" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_archivos_efectos",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "archivos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"documento_id" integer NOT NULL,
  	"empresa_id" integer,
  	"relacion" varchar DEFAULT 'Original' NOT NULL,
  	"nueva_caducidad" timestamp(3) with time zone,
  	"nuevo_aviso" timestamp(3) with time zone,
  	"comentario" varchar,
  	"historico" boolean DEFAULT false,
  	"tamano_original" numeric,
  	"subido_por_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "envios" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"titulo" varchar NOT NULL,
  	"empresa_id" integer NOT NULL,
  	"documento_relacionado_id" integer,
  	"relacion" varchar DEFAULT 'Renovación',
  	"nueva_caducidad" timestamp(3) with time zone,
  	"comentario" varchar,
  	"estado" "enum_envios_estado" DEFAULT 'pendiente',
  	"documento_destino_id" integer,
  	"relacion_final" varchar,
  	"categoria_destino_id" integer,
  	"titulo_final" varchar,
  	"fecha_emision" timestamp(3) with time zone,
  	"fecha_caducidad" timestamp(3) with time zone,
  	"fecha_aviso" timestamp(3) with time zone,
  	"motivo_rechazo" varchar,
  	"tamano_original" numeric,
  	"enviado_por_id" integer,
  	"resuelto_por_id" integer,
  	"resuelto_en" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "hilos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"asunto" varchar NOT NULL,
  	"empresa_id" integer NOT NULL,
  	"categoria_id" integer,
  	"documento_id" integer,
  	"estado" "enum_hilos_estado" DEFAULT 'abierto',
  	"asignado_id" integer,
  	"creado_por_id" integer,
  	"ultimo_mensaje" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mensajes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hilo_id" integer NOT NULL,
  	"texto" varchar NOT NULL,
  	"empresa_id" integer,
  	"autor_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mensajes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"adjuntos_id" integer
  );
  
  CREATE TABLE "adjuntos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"empresa_id" integer NOT NULL,
  	"subido_por_id" integer,
  	"tamano_original" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "users_empresas" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"empresa_id" integer NOT NULL,
  	"rol" "enum_users_empresas_rol" DEFAULT 'usuario' NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"nombre" varchar NOT NULL,
  	"rol" "enum_users_rol" DEFAULT 'cliente' NOT NULL,
  	"recibe_avisos" boolean DEFAULT false,
  	"activo" boolean DEFAULT true,
  	"totp_activo" boolean DEFAULT false,
  	"totp_secreto" varchar,
  	"totp_pendiente" varchar,
  	"totp_ultimo_paso" numeric,
  	"invitacion_hash" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "catalogo_efectos" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_catalogo_efectos",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "catalogo" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tipo" "enum_catalogo_tipo" NOT NULL,
  	"nombre" varchar NOT NULL,
  	"usos" numeric DEFAULT 0,
  	"activo" boolean DEFAULT true,
  	"fusionar_en_id" integer,
  	"normalizado" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "correos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"asunto" varchar NOT NULL,
  	"para" varchar NOT NULL,
  	"usuario_id" integer,
  	"destinatario" "enum_correos_destinatario" DEFAULT 'cliente',
  	"estado" "enum_correos_estado" DEFAULT 'pendiente',
  	"plantilla" varchar,
  	"texto" varchar,
  	"empresa_id" integer,
  	"documento_id" integer,
  	"hilo_id" integer,
  	"idempotencia" varchar,
  	"message_id" varchar,
  	"error" varchar,
  	"enviado_en" timestamp(3) with time zone,
  	"entregado_en" timestamp(3) with time zone,
  	"abierto_en" timestamp(3) with time zone,
  	"rebote_en" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "actividad" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"accion" "enum_actividad_accion" NOT NULL,
  	"descripcion" varchar NOT NULL,
  	"usuario_id" integer,
  	"email" varchar,
  	"empresa_id" integer,
  	"origen" "enum_actividad_origen",
  	"coleccion" varchar,
  	"registro_id" varchar,
  	"ip" varchar,
  	"user_agent" varchar,
  	"datos" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "originales" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"coleccion" varchar,
  	"registro_id" varchar,
  	"empresa_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "oauth_clientes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_id" varchar NOT NULL,
  	"nombre" varchar NOT NULL,
  	"redirect_uris" jsonb NOT NULL,
  	"bloqueado" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "oauth_codigos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hash" varchar NOT NULL,
  	"client_id" varchar NOT NULL,
  	"usuario_id" integer NOT NULL,
  	"redirect_uri" varchar NOT NULL,
  	"code_challenge" varchar NOT NULL,
  	"caduca" timestamp(3) with time zone NOT NULL,
  	"usado" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_mcp_api_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"label" varchar,
  	"description" varchar,
  	"payload_mcp_tool_mis_empresas" boolean DEFAULT true,
  	"payload_mcp_tool_buscar_documentos" boolean DEFAULT true,
  	"payload_mcp_tool_proximos_vencimientos" boolean DEFAULT true,
  	"payload_mcp_tool_ver_documento" boolean DEFAULT true,
  	"payload_mcp_tool_enlace_descarga" boolean DEFAULT true,
  	"payload_mcp_tool_descargar_zip" boolean DEFAULT true,
  	"payload_mcp_tool_exportar_inventario" boolean DEFAULT true,
  	"payload_mcp_tool_avisos" boolean DEFAULT true,
  	"payload_mcp_tool_listar_envios" boolean DEFAULT true,
  	"payload_mcp_tool_listar_conversaciones" boolean DEFAULT true,
  	"payload_mcp_tool_ver_conversacion" boolean DEFAULT true,
  	"payload_mcp_tool_usuarios_de_empresa" boolean DEFAULT true,
  	"payload_mcp_tool_registro_actividad" boolean DEFAULT true,
  	"payload_mcp_tool_buscar_nombre_catalogo" boolean DEFAULT true,
  	"payload_mcp_tool_almacenamiento" boolean DEFAULT true,
  	"payload_mcp_tool_enviar_documento_a_cmc" boolean DEFAULT true,
  	"payload_mcp_tool_escribir_a_cmc" boolean DEFAULT true,
  	"payload_mcp_tool_dar_de_alta_usuario" boolean DEFAULT true,
  	"payload_mcp_tool_quitar_acceso_usuario" boolean DEFAULT true,
  	"payload_mcp_tool_cambiar_rol_usuario" boolean DEFAULT true,
  	"payload_mcp_tool_alta_empresa" boolean DEFAULT true,
  	"payload_mcp_tool_baja_o_reactivacion_empresa" boolean DEFAULT true,
  	"payload_mcp_tool_crear_categoria" boolean DEFAULT true,
  	"payload_mcp_tool_crear_documento" boolean DEFAULT true,
  	"payload_mcp_tool_editar_documento" boolean DEFAULT true,
  	"payload_mcp_tool_asociar_archivo" boolean DEFAULT true,
  	"payload_mcp_tool_publicar_envio" boolean DEFAULT true,
  	"payload_mcp_tool_rechazar_envio" boolean DEFAULT true,
  	"payload_mcp_tool_cambiar_estado_manual" boolean DEFAULT true,
  	"payload_mcp_tool_cambiar_modalidad_gestion" boolean DEFAULT true,
  	"payload_mcp_tool_gestionar_conversacion" boolean DEFAULT true,
  	"payload_mcp_tool_exportar_comunicaciones" boolean DEFAULT true,
  	"origen" "enum_payload_mcp_api_keys_origen" DEFAULT 'manual',
  	"client_id" varchar,
  	"caduca" timestamp(3) with time zone,
  	"renovacion_hash" varchar,
  	"renovacion_caduca" timestamp(3) with time zone,
  	"ultimo_uso" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"meta" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"empresas_id" integer,
  	"categorias_id" integer,
  	"documentos_id" integer,
  	"archivos_id" integer,
  	"envios_id" integer,
  	"hilos_id" integer,
  	"mensajes_id" integer,
  	"adjuntos_id" integer,
  	"users_id" integer,
  	"catalogo_id" integer,
  	"correos_id" integer,
  	"actividad_id" integer,
  	"media_id" integer,
  	"originales_id" integer,
  	"oauth_clientes_id" integer,
  	"oauth_codigos_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "configuracion_plantilla_categorias" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"nombre" varchar NOT NULL,
  	"antelacion_meses" numeric,
  	"gestion" "enum_configuracion_plantilla_categorias_gestion",
  	"descripcion" varchar
  );
  
  CREATE TABLE "configuracion" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"antelacion_meses" numeric DEFAULT 2,
  	"recordatorio_dias_antes" numeric DEFAULT 15,
  	"frecuencia_caducado" "enum_configuracion_frecuencia_caducado" DEFAULT 'semanal',
  	"max_recordatorios_caducado" numeric DEFAULT 6,
  	"remitente_nombre" varchar DEFAULT 'CMC · Portal documental',
  	"remitente_email" varchar,
  	"responder_a" varchar,
  	"logo_id" integer,
  	"color_primario" varchar DEFAULT '#4d6162',
  	"firma" varchar DEFAULT 'CMC · Consultoría de calidad y medio ambiente',
  	"plantillas_proxima_no_gestionado_asunto" varchar DEFAULT 'Su documento «{{documento}}» caduca el {{caducidad}} — requiere su revisión',
  	"plantillas_proxima_no_gestionado_cuerpo" varchar DEFAULT 'Le informamos de que este documento caduca el {{caducidad}}. Revíselo y gestione su renovación; cuando disponga del nuevo documento, puede subirlo al portal o enviárnoslo.',
  	"plantillas_proxima_no_gestionado_boton" varchar DEFAULT 'Ver documento',
  	"plantillas_proxima_gestionado_asunto" varchar DEFAULT 'Su documento «{{documento}}» caduca el {{caducidad}} — CMC se encarga',
  	"plantillas_proxima_gestionado_cuerpo" varchar DEFAULT 'Le informamos de que este documento caduca el {{caducidad}}. No necesita hacer nada: CMC gestiona su renovación y le avisaremos cuando el nuevo documento esté disponible en el portal.',
  	"plantillas_proxima_gestionado_boton" varchar DEFAULT 'Ver documento',
  	"plantillas_proxima_tecnico_asunto" varchar DEFAULT 'Iniciar renovación: «{{documento}}» de {{empresa}} caduca el {{caducidad}}',
  	"plantillas_proxima_tecnico_cuerpo" varchar DEFAULT 'El documento «{{documento}}» de {{empresa}} está gestionado por CMC y caduca el {{caducidad}}. Inicie su renovación.',
  	"plantillas_proxima_tecnico_boton" varchar DEFAULT 'Abrir documento',
  	"plantillas_recordatorio_no_gestionado_asunto" varchar DEFAULT 'Recordatorio: «{{documento}}» caduca en {{dias}} días',
  	"plantillas_recordatorio_no_gestionado_cuerpo" varchar DEFAULT 'Todavía no hemos recibido la renovación de este documento, que caduca el {{caducidad}}. Cuando disponga del nuevo documento, súbalo al portal o envíenoslo.',
  	"plantillas_recordatorio_no_gestionado_boton" varchar DEFAULT 'Enviar renovación',
  	"plantillas_recordatorio_tecnico_asunto" varchar DEFAULT 'Recordatorio: «{{documento}}» de {{empresa}} caduca en {{dias}} días',
  	"plantillas_recordatorio_tecnico_cuerpo" varchar DEFAULT 'La renovación del documento «{{documento}}» de {{empresa}} sigue pendiente. Caduca el {{caducidad}}.',
  	"plantillas_recordatorio_tecnico_boton" varchar DEFAULT 'Abrir documento',
  	"plantillas_caducado_no_gestionado_asunto" varchar DEFAULT 'El documento «{{documento}}» de {{empresa}} ha caducado',
  	"plantillas_caducado_no_gestionado_cuerpo" varchar DEFAULT 'Este documento caducó el {{caducidad}} y ya no está vigente. Gestione su renovación lo antes posible y envíenos el nuevo documento desde el portal.',
  	"plantillas_caducado_no_gestionado_boton" varchar DEFAULT 'Ver documento',
  	"plantillas_caducado_gestionado_asunto" varchar DEFAULT 'El documento «{{documento}}» ha caducado — CMC lo está tramitando',
  	"plantillas_caducado_gestionado_cuerpo" varchar DEFAULT 'Este documento caducó el {{caducidad}}. No necesita hacer nada: CMC está tramitando su renovación y le avisaremos en cuanto el nuevo documento esté disponible.',
  	"plantillas_caducado_gestionado_boton" varchar DEFAULT 'Ver documento',
  	"plantillas_caducado_tecnico_asunto" varchar DEFAULT 'Caducado: «{{documento}}» de {{empresa}}',
  	"plantillas_caducado_tecnico_cuerpo" varchar DEFAULT 'El documento «{{documento}}» de {{empresa}}, gestionado por CMC, caducó el {{caducidad}} sin renovación publicada.',
  	"plantillas_caducado_tecnico_boton" varchar DEFAULT 'Abrir documento',
  	"plantillas_recordatorio_caducado_no_gestionado_asunto" varchar DEFAULT 'Sigue caducado: «{{documento}}» desde el {{caducidad}}',
  	"plantillas_recordatorio_caducado_no_gestionado_cuerpo" varchar DEFAULT 'El documento «{{documento}}» continúa caducado desde el {{caducidad}}. Envíenos la renovación desde el portal en cuanto la tenga.',
  	"plantillas_recordatorio_caducado_no_gestionado_boton" varchar DEFAULT 'Enviar renovación',
  	"plantillas_recordatorio_caducado_tecnico_asunto" varchar DEFAULT 'Sigue caducado: «{{documento}}» de {{empresa}}',
  	"plantillas_recordatorio_caducado_tecnico_cuerpo" varchar DEFAULT 'El documento «{{documento}}» de {{empresa}} continúa caducado desde el {{caducidad}}.',
  	"plantillas_recordatorio_caducado_tecnico_boton" varchar DEFAULT 'Abrir documento',
  	"plantillas_renovacion_disponible_asunto" varchar DEFAULT 'Nuevo documento disponible: «{{documento}}»',
  	"plantillas_renovacion_disponible_cuerpo" varchar DEFAULT 'CMC ha publicado un nuevo archivo ({{tipo}}) en el documento «{{documento}}» de {{empresa}}.',
  	"plantillas_renovacion_disponible_boton" varchar DEFAULT 'Ver documento',
  	"plantillas_resumen_semanal_asunto" varchar DEFAULT 'Resumen semanal: {{total}} documentos en naranja o rojo',
  	"plantillas_resumen_semanal_cuerpo" varchar DEFAULT 'Documentos con caducidad próxima o caducados en todas las empresas:
  
  {{resumen}}',
  	"plantillas_resumen_semanal_boton" varchar DEFAULT 'Abrir panel',
  	"plantillas_invitacion_asunto" varchar DEFAULT 'Le damos la bienvenida al portal documental de CMC',
  	"plantillas_invitacion_cuerpo" varchar DEFAULT 'Hola, {{nombre}}. Se le ha dado acceso al portal documental de CMC para {{empresa}}. Pulse el botón para elegir su contraseña. El enlace caduca en 72 horas.',
  	"plantillas_invitacion_boton" varchar DEFAULT 'Elegir contraseña',
  	"plantillas_acceso_empresa_asunto" varchar DEFAULT 'Tiene acceso a {{empresa}} en el portal de CMC',
  	"plantillas_acceso_empresa_cuerpo" varchar DEFAULT 'Hola, {{nombre}}. Se le ha dado acceso a {{empresa}} en el portal documental de CMC. Puede elegirla en el selector de empresa al entrar.',
  	"plantillas_acceso_empresa_boton" varchar DEFAULT 'Entrar al portal',
  	"plantillas_recuperar_password_asunto" varchar DEFAULT 'Restablecer su contraseña del portal de CMC',
  	"plantillas_recuperar_password_cuerpo" varchar DEFAULT 'Hemos recibido una solicitud para restablecer su contraseña. Si no la ha hecho usted, ignore este correo. El enlace caduca en una hora.',
  	"plantillas_recuperar_password_boton" varchar DEFAULT 'Restablecer contraseña',
  	"plantillas_envio_recibido_asunto" varchar DEFAULT 'Nuevo envío de {{empresa}}: «{{documento}}»',
  	"plantillas_envio_recibido_cuerpo" varchar DEFAULT '{{nombre}} ha enviado «{{documento}}» para su revisión.',
  	"plantillas_envio_recibido_boton" varchar DEFAULT 'Revisar envío',
  	"plantillas_envio_publicado_asunto" varchar DEFAULT 'Su envío «{{documento}}» se ha publicado',
  	"plantillas_envio_publicado_cuerpo" varchar DEFAULT 'CMC ha revisado y publicado el documento que nos envió.',
  	"plantillas_envio_publicado_boton" varchar DEFAULT 'Ver documento',
  	"plantillas_envio_rechazado_asunto" varchar DEFAULT 'Su envío «{{documento}}» no se ha publicado',
  	"plantillas_envio_rechazado_cuerpo" varchar DEFAULT 'CMC ha revisado el documento que nos envió y no lo ha publicado. Motivo: {{motivo}}',
  	"plantillas_envio_rechazado_boton" varchar DEFAULT 'Ver mis envíos',
  	"plantillas_nuevo_mensaje_asunto" varchar DEFAULT 'Nuevo mensaje en «{{asunto}}»',
  	"plantillas_nuevo_mensaje_cuerpo" varchar DEFAULT '{{nombre}} ha escrito en la conversación «{{asunto}}» de {{empresa}}:
  
  {{mensaje}}
  
  Responda desde el portal para que quede registrado.',
  	"plantillas_nuevo_mensaje_boton" varchar DEFAULT 'Responder en el portal',
  	"plantillas_almacenamiento_asunto" varchar DEFAULT 'El portal ha consumido el {{uso}} % del almacenamiento incluido',
  	"plantillas_almacenamiento_cuerpo" varchar DEFAULT 'El almacenamiento consumido es de {{consumido}} de {{limite}} incluidos. Superado ese volumen puede haber cargos adicionales.',
  	"plantillas_almacenamiento_boton" varchar DEFAULT 'Ver consumo',
  	"lado_maximo" numeric DEFAULT 2500,
  	"calidad" numeric DEFAULT 82,
  	"conservar_original" boolean DEFAULT false,
  	"limite_g_b" numeric DEFAULT 10,
  	"aviso_porcentaje" numeric DEFAULT 80,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload_jobs_stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"stats" jsonb,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "empresas_emails_aviso" ADD CONSTRAINT "empresas_emails_aviso_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "empresas" ADD CONSTRAINT "empresas_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "empresas" ADD CONSTRAINT "empresas_tecnico_id_users_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categorias" ADD CONSTRAINT "categorias_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categorias" ADD CONSTRAINT "categorias_responsable_id_users_id_fk" FOREIGN KEY ("responsable_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documentos" ADD CONSTRAINT "documentos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documentos" ADD CONSTRAINT "documentos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documentos" ADD CONSTRAINT "documentos_tecnico_id_users_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documentos" ADD CONSTRAINT "documentos_archivo_vigente_id_archivos_id_fk" FOREIGN KEY ("archivo_vigente_id") REFERENCES "public"."archivos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "documentos_texts" ADD CONSTRAINT "documentos_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "archivos_efectos" ADD CONSTRAINT "archivos_efectos_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."archivos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "archivos" ADD CONSTRAINT "archivos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "archivos" ADD CONSTRAINT "archivos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "archivos" ADD CONSTRAINT "archivos_subido_por_id_users_id_fk" FOREIGN KEY ("subido_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "envios" ADD CONSTRAINT "envios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "envios" ADD CONSTRAINT "envios_documento_relacionado_id_documentos_id_fk" FOREIGN KEY ("documento_relacionado_id") REFERENCES "public"."documentos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "envios" ADD CONSTRAINT "envios_documento_destino_id_documentos_id_fk" FOREIGN KEY ("documento_destino_id") REFERENCES "public"."documentos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "envios" ADD CONSTRAINT "envios_categoria_destino_id_categorias_id_fk" FOREIGN KEY ("categoria_destino_id") REFERENCES "public"."categorias"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "envios" ADD CONSTRAINT "envios_enviado_por_id_users_id_fk" FOREIGN KEY ("enviado_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "envios" ADD CONSTRAINT "envios_resuelto_por_id_users_id_fk" FOREIGN KEY ("resuelto_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "hilos" ADD CONSTRAINT "hilos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "hilos" ADD CONSTRAINT "hilos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "hilos" ADD CONSTRAINT "hilos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "hilos" ADD CONSTRAINT "hilos_asignado_id_users_id_fk" FOREIGN KEY ("asignado_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "hilos" ADD CONSTRAINT "hilos_creado_por_id_users_id_fk" FOREIGN KEY ("creado_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_hilo_id_hilos_id_fk" FOREIGN KEY ("hilo_id") REFERENCES "public"."hilos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mensajes" ADD CONSTRAINT "mensajes_autor_id_users_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "mensajes_rels" ADD CONSTRAINT "mensajes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mensajes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mensajes_rels" ADD CONSTRAINT "mensajes_rels_adjuntos_fk" FOREIGN KEY ("adjuntos_id") REFERENCES "public"."adjuntos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "adjuntos" ADD CONSTRAINT "adjuntos_subido_por_id_users_id_fk" FOREIGN KEY ("subido_por_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_empresas" ADD CONSTRAINT "users_empresas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_empresas" ADD CONSTRAINT "users_empresas_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "catalogo_efectos" ADD CONSTRAINT "catalogo_efectos_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."catalogo"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "catalogo" ADD CONSTRAINT "catalogo_fusionar_en_id_catalogo_id_fk" FOREIGN KEY ("fusionar_en_id") REFERENCES "public"."catalogo"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "correos" ADD CONSTRAINT "correos_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "correos" ADD CONSTRAINT "correos_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "correos" ADD CONSTRAINT "correos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "correos" ADD CONSTRAINT "correos_hilo_id_hilos_id_fk" FOREIGN KEY ("hilo_id") REFERENCES "public"."hilos"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "actividad" ADD CONSTRAINT "actividad_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "actividad" ADD CONSTRAINT "actividad_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "originales" ADD CONSTRAINT "originales_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "oauth_codigos" ADD CONSTRAINT "oauth_codigos_usuario_id_users_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_empresas_fk" FOREIGN KEY ("empresas_id") REFERENCES "public"."empresas"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categorias_fk" FOREIGN KEY ("categorias_id") REFERENCES "public"."categorias"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_documentos_fk" FOREIGN KEY ("documentos_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_archivos_fk" FOREIGN KEY ("archivos_id") REFERENCES "public"."archivos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_envios_fk" FOREIGN KEY ("envios_id") REFERENCES "public"."envios"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_hilos_fk" FOREIGN KEY ("hilos_id") REFERENCES "public"."hilos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mensajes_fk" FOREIGN KEY ("mensajes_id") REFERENCES "public"."mensajes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_adjuntos_fk" FOREIGN KEY ("adjuntos_id") REFERENCES "public"."adjuntos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_catalogo_fk" FOREIGN KEY ("catalogo_id") REFERENCES "public"."catalogo"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_correos_fk" FOREIGN KEY ("correos_id") REFERENCES "public"."correos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_actividad_fk" FOREIGN KEY ("actividad_id") REFERENCES "public"."actividad"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_originales_fk" FOREIGN KEY ("originales_id") REFERENCES "public"."originales"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_clientes_fk" FOREIGN KEY ("oauth_clientes_id") REFERENCES "public"."oauth_clientes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_oauth_codigos_fk" FOREIGN KEY ("oauth_codigos_id") REFERENCES "public"."oauth_codigos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "configuracion_plantilla_categorias" ADD CONSTRAINT "configuracion_plantilla_categorias_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."configuracion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "configuracion" ADD CONSTRAINT "configuracion_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "empresas_emails_aviso_order_idx" ON "empresas_emails_aviso" USING btree ("_order");
  CREATE INDEX "empresas_emails_aviso_parent_id_idx" ON "empresas_emails_aviso" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "empresas_cif_idx" ON "empresas" USING btree ("cif");
  CREATE INDEX "empresas_logo_idx" ON "empresas" USING btree ("logo_id");
  CREATE INDEX "empresas_tecnico_idx" ON "empresas" USING btree ("tecnico_id");
  CREATE INDEX "empresas_updated_at_idx" ON "empresas" USING btree ("updated_at");
  CREATE INDEX "empresas_created_at_idx" ON "empresas" USING btree ("created_at");
  CREATE INDEX "categorias_empresa_idx" ON "categorias" USING btree ("empresa_id");
  CREATE INDEX "categorias_responsable_idx" ON "categorias" USING btree ("responsable_id");
  CREATE INDEX "categorias_updated_at_idx" ON "categorias" USING btree ("updated_at");
  CREATE INDEX "categorias_created_at_idx" ON "categorias" USING btree ("created_at");
  CREATE INDEX "documentos_empresa_idx" ON "documentos" USING btree ("empresa_id");
  CREATE INDEX "documentos_categoria_idx" ON "documentos" USING btree ("categoria_id");
  CREATE INDEX "documentos_fecha_caducidad_idx" ON "documentos" USING btree ("fecha_caducidad");
  CREATE INDEX "documentos_fecha_aviso_idx" ON "documentos" USING btree ("fecha_aviso");
  CREATE INDEX "documentos_estado_idx" ON "documentos" USING btree ("estado");
  CREATE INDEX "documentos_tecnico_idx" ON "documentos" USING btree ("tecnico_id");
  CREATE INDEX "documentos_archivo_vigente_idx" ON "documentos" USING btree ("archivo_vigente_id");
  CREATE INDEX "documentos_updated_at_idx" ON "documentos" USING btree ("updated_at");
  CREATE INDEX "documentos_created_at_idx" ON "documentos" USING btree ("created_at");
  CREATE INDEX "documentos_texts_order_parent" ON "documentos_texts" USING btree ("order","parent_id");
  CREATE INDEX "archivos_efectos_order_idx" ON "archivos_efectos" USING btree ("order");
  CREATE INDEX "archivos_efectos_parent_idx" ON "archivos_efectos" USING btree ("parent_id");
  CREATE INDEX "archivos_documento_idx" ON "archivos" USING btree ("documento_id");
  CREATE INDEX "archivos_empresa_idx" ON "archivos" USING btree ("empresa_id");
  CREATE INDEX "archivos_historico_idx" ON "archivos" USING btree ("historico");
  CREATE INDEX "archivos_subido_por_idx" ON "archivos" USING btree ("subido_por_id");
  CREATE INDEX "archivos_updated_at_idx" ON "archivos" USING btree ("updated_at");
  CREATE INDEX "archivos_created_at_idx" ON "archivos" USING btree ("created_at");
  CREATE UNIQUE INDEX "archivos_filename_idx" ON "archivos" USING btree ("filename");
  CREATE INDEX "envios_empresa_idx" ON "envios" USING btree ("empresa_id");
  CREATE INDEX "envios_documento_relacionado_idx" ON "envios" USING btree ("documento_relacionado_id");
  CREATE INDEX "envios_estado_idx" ON "envios" USING btree ("estado");
  CREATE INDEX "envios_documento_destino_idx" ON "envios" USING btree ("documento_destino_id");
  CREATE INDEX "envios_categoria_destino_idx" ON "envios" USING btree ("categoria_destino_id");
  CREATE INDEX "envios_enviado_por_idx" ON "envios" USING btree ("enviado_por_id");
  CREATE INDEX "envios_resuelto_por_idx" ON "envios" USING btree ("resuelto_por_id");
  CREATE INDEX "envios_updated_at_idx" ON "envios" USING btree ("updated_at");
  CREATE INDEX "envios_created_at_idx" ON "envios" USING btree ("created_at");
  CREATE UNIQUE INDEX "envios_filename_idx" ON "envios" USING btree ("filename");
  CREATE INDEX "hilos_empresa_idx" ON "hilos" USING btree ("empresa_id");
  CREATE INDEX "hilos_categoria_idx" ON "hilos" USING btree ("categoria_id");
  CREATE INDEX "hilos_documento_idx" ON "hilos" USING btree ("documento_id");
  CREATE INDEX "hilos_estado_idx" ON "hilos" USING btree ("estado");
  CREATE INDEX "hilos_asignado_idx" ON "hilos" USING btree ("asignado_id");
  CREATE INDEX "hilos_creado_por_idx" ON "hilos" USING btree ("creado_por_id");
  CREATE INDEX "hilos_ultimo_mensaje_idx" ON "hilos" USING btree ("ultimo_mensaje");
  CREATE INDEX "hilos_updated_at_idx" ON "hilos" USING btree ("updated_at");
  CREATE INDEX "hilos_created_at_idx" ON "hilos" USING btree ("created_at");
  CREATE INDEX "mensajes_hilo_idx" ON "mensajes" USING btree ("hilo_id");
  CREATE INDEX "mensajes_empresa_idx" ON "mensajes" USING btree ("empresa_id");
  CREATE INDEX "mensajes_autor_idx" ON "mensajes" USING btree ("autor_id");
  CREATE INDEX "mensajes_updated_at_idx" ON "mensajes" USING btree ("updated_at");
  CREATE INDEX "mensajes_created_at_idx" ON "mensajes" USING btree ("created_at");
  CREATE INDEX "mensajes_rels_order_idx" ON "mensajes_rels" USING btree ("order");
  CREATE INDEX "mensajes_rels_parent_idx" ON "mensajes_rels" USING btree ("parent_id");
  CREATE INDEX "mensajes_rels_path_idx" ON "mensajes_rels" USING btree ("path");
  CREATE INDEX "mensajes_rels_adjuntos_id_idx" ON "mensajes_rels" USING btree ("adjuntos_id");
  CREATE INDEX "adjuntos_empresa_idx" ON "adjuntos" USING btree ("empresa_id");
  CREATE INDEX "adjuntos_subido_por_idx" ON "adjuntos" USING btree ("subido_por_id");
  CREATE INDEX "adjuntos_updated_at_idx" ON "adjuntos" USING btree ("updated_at");
  CREATE INDEX "adjuntos_created_at_idx" ON "adjuntos" USING btree ("created_at");
  CREATE UNIQUE INDEX "adjuntos_filename_idx" ON "adjuntos" USING btree ("filename");
  CREATE INDEX "users_empresas_order_idx" ON "users_empresas" USING btree ("_order");
  CREATE INDEX "users_empresas_parent_id_idx" ON "users_empresas" USING btree ("_parent_id");
  CREATE INDEX "users_empresas_empresa_idx" ON "users_empresas" USING btree ("empresa_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "catalogo_efectos_order_idx" ON "catalogo_efectos" USING btree ("order");
  CREATE INDEX "catalogo_efectos_parent_idx" ON "catalogo_efectos" USING btree ("parent_id");
  CREATE INDEX "catalogo_tipo_idx" ON "catalogo" USING btree ("tipo");
  CREATE INDEX "catalogo_fusionar_en_idx" ON "catalogo" USING btree ("fusionar_en_id");
  CREATE INDEX "catalogo_normalizado_idx" ON "catalogo" USING btree ("normalizado");
  CREATE INDEX "catalogo_updated_at_idx" ON "catalogo" USING btree ("updated_at");
  CREATE INDEX "catalogo_created_at_idx" ON "catalogo" USING btree ("created_at");
  CREATE INDEX "correos_para_idx" ON "correos" USING btree ("para");
  CREATE INDEX "correos_usuario_idx" ON "correos" USING btree ("usuario_id");
  CREATE INDEX "correos_estado_idx" ON "correos" USING btree ("estado");
  CREATE INDEX "correos_plantilla_idx" ON "correos" USING btree ("plantilla");
  CREATE INDEX "correos_empresa_idx" ON "correos" USING btree ("empresa_id");
  CREATE INDEX "correos_documento_idx" ON "correos" USING btree ("documento_id");
  CREATE INDEX "correos_hilo_idx" ON "correos" USING btree ("hilo_id");
  CREATE INDEX "correos_idempotencia_idx" ON "correos" USING btree ("idempotencia");
  CREATE INDEX "correos_message_id_idx" ON "correos" USING btree ("message_id");
  CREATE INDEX "correos_updated_at_idx" ON "correos" USING btree ("updated_at");
  CREATE INDEX "correos_created_at_idx" ON "correos" USING btree ("created_at");
  CREATE INDEX "actividad_accion_idx" ON "actividad" USING btree ("accion");
  CREATE INDEX "actividad_usuario_idx" ON "actividad" USING btree ("usuario_id");
  CREATE INDEX "actividad_empresa_idx" ON "actividad" USING btree ("empresa_id");
  CREATE INDEX "actividad_origen_idx" ON "actividad" USING btree ("origen");
  CREATE INDEX "actividad_registro_id_idx" ON "actividad" USING btree ("registro_id");
  CREATE INDEX "actividad_updated_at_idx" ON "actividad" USING btree ("updated_at");
  CREATE INDEX "actividad_created_at_idx" ON "actividad" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "originales_registro_id_idx" ON "originales" USING btree ("registro_id");
  CREATE INDEX "originales_empresa_idx" ON "originales" USING btree ("empresa_id");
  CREATE INDEX "originales_updated_at_idx" ON "originales" USING btree ("updated_at");
  CREATE INDEX "originales_created_at_idx" ON "originales" USING btree ("created_at");
  CREATE UNIQUE INDEX "originales_filename_idx" ON "originales" USING btree ("filename");
  CREATE UNIQUE INDEX "oauth_clientes_client_id_idx" ON "oauth_clientes" USING btree ("client_id");
  CREATE INDEX "oauth_clientes_updated_at_idx" ON "oauth_clientes" USING btree ("updated_at");
  CREATE INDEX "oauth_clientes_created_at_idx" ON "oauth_clientes" USING btree ("created_at");
  CREATE UNIQUE INDEX "oauth_codigos_hash_idx" ON "oauth_codigos" USING btree ("hash");
  CREATE INDEX "oauth_codigos_usuario_idx" ON "oauth_codigos" USING btree ("usuario_id");
  CREATE INDEX "oauth_codigos_updated_at_idx" ON "oauth_codigos" USING btree ("updated_at");
  CREATE INDEX "oauth_codigos_created_at_idx" ON "oauth_codigos" USING btree ("created_at");
  CREATE INDEX "payload_mcp_api_keys_user_idx" ON "payload_mcp_api_keys" USING btree ("user_id");
  CREATE INDEX "payload_mcp_api_keys_renovacion_hash_idx" ON "payload_mcp_api_keys" USING btree ("renovacion_hash");
  CREATE INDEX "payload_mcp_api_keys_updated_at_idx" ON "payload_mcp_api_keys" USING btree ("updated_at");
  CREATE INDEX "payload_mcp_api_keys_created_at_idx" ON "payload_mcp_api_keys" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_empresas_id_idx" ON "payload_locked_documents_rels" USING btree ("empresas_id");
  CREATE INDEX "payload_locked_documents_rels_categorias_id_idx" ON "payload_locked_documents_rels" USING btree ("categorias_id");
  CREATE INDEX "payload_locked_documents_rels_documentos_id_idx" ON "payload_locked_documents_rels" USING btree ("documentos_id");
  CREATE INDEX "payload_locked_documents_rels_archivos_id_idx" ON "payload_locked_documents_rels" USING btree ("archivos_id");
  CREATE INDEX "payload_locked_documents_rels_envios_id_idx" ON "payload_locked_documents_rels" USING btree ("envios_id");
  CREATE INDEX "payload_locked_documents_rels_hilos_id_idx" ON "payload_locked_documents_rels" USING btree ("hilos_id");
  CREATE INDEX "payload_locked_documents_rels_mensajes_id_idx" ON "payload_locked_documents_rels" USING btree ("mensajes_id");
  CREATE INDEX "payload_locked_documents_rels_adjuntos_id_idx" ON "payload_locked_documents_rels" USING btree ("adjuntos_id");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_catalogo_id_idx" ON "payload_locked_documents_rels" USING btree ("catalogo_id");
  CREATE INDEX "payload_locked_documents_rels_correos_id_idx" ON "payload_locked_documents_rels" USING btree ("correos_id");
  CREATE INDEX "payload_locked_documents_rels_actividad_id_idx" ON "payload_locked_documents_rels" USING btree ("actividad_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_originales_id_idx" ON "payload_locked_documents_rels" USING btree ("originales_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_clientes_id_idx" ON "payload_locked_documents_rels" USING btree ("oauth_clientes_id");
  CREATE INDEX "payload_locked_documents_rels_oauth_codigos_id_idx" ON "payload_locked_documents_rels" USING btree ("oauth_codigos_id");
  CREATE INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx" ON "payload_preferences_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "configuracion_plantilla_categorias_order_idx" ON "configuracion_plantilla_categorias" USING btree ("_order");
  CREATE INDEX "configuracion_plantilla_categorias_parent_id_idx" ON "configuracion_plantilla_categorias" USING btree ("_parent_id");
  CREATE INDEX "configuracion_logo_idx" ON "configuracion" USING btree ("logo_id");

-- 20261116_161224_web
CREATE TYPE "public"."enum_servicios_area" AS ENUM('calidad', 'medio-ambiente', 'gestion');
  CREATE TYPE "public"."enum_trabajos_area" AS ENUM('calidad', 'medio-ambiente', 'gestion');
  CREATE TYPE "public"."enum_consultas_estado" AS ENUM('nueva', 'atendida', 'descartada');
  ALTER TYPE "public"."enum_actividad_accion" ADD VALUE 'consulta';
  CREATE TABLE "servicios_puntos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"texto" varchar NOT NULL
  );
  
  CREATE TABLE "servicios" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"titulo" varchar NOT NULL,
  	"slug" varchar,
  	"area" "enum_servicios_area" DEFAULT 'calidad' NOT NULL,
  	"resumen" varchar NOT NULL,
  	"enlace" varchar,
  	"texto_enlace" varchar,
  	"destacado" boolean DEFAULT false,
  	"orden" numeric DEFAULT 100,
  	"publicado" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "trabajos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"titulo" varchar NOT NULL,
  	"descripcion" varchar,
  	"cliente" varchar,
  	"lugar" varchar,
  	"anio" numeric,
  	"area" "enum_trabajos_area" DEFAULT 'calidad' NOT NULL,
  	"orden" numeric DEFAULT 100,
  	"publicado" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "consultas" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"nombre" varchar NOT NULL,
  	"empresa" varchar,
  	"email" varchar NOT NULL,
  	"telefono" varchar,
  	"servicio" varchar,
  	"mensaje" varchar NOT NULL,
  	"estado" "enum_consultas_estado" DEFAULT 'nueva',
  	"notas" varchar,
  	"acepta_privacidad" boolean,
  	"ip" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "web_profesionales" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"titulo" varchar NOT NULL,
  	"texto" varchar NOT NULL
  );
  
  CREATE TABLE "web_sedes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"ciudad" varchar NOT NULL,
  	"telefono" varchar NOT NULL,
  	"direccion" varchar NOT NULL,
  	"codigo_postal" varchar NOT NULL
  );
  
  CREATE TABLE "web_emails_consultas" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL
  );
  
  CREATE TABLE "web" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"portada_antetitulo" varchar,
  	"portada_titulo" varchar,
  	"portada_subtitulo" varchar,
  	"portada_imagen_id" integer,
  	"descripcion" varchar,
  	"presentacion" varchar,
  	"email" varchar,
  	"legal_titular" varchar,
  	"legal_cif" varchar,
  	"legal_domicilio" varchar,
  	"legal_registro" varchar,
  	"aviso_legal" varchar,
  	"privacidad" varchar,
  	"cookies" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "servicios_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "trabajos_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "consultas_id" integer;
  ALTER TABLE "configuracion" ADD COLUMN "plantillas_consulta_web_asunto" varchar DEFAULT 'Consulta de {{nombre}} desde la web';
  ALTER TABLE "configuracion" ADD COLUMN "plantillas_consulta_web_cuerpo" varchar DEFAULT '{{nombre}} ({{empresa}}) ha escrito desde el formulario de contacto.
  
  Correo: {{email}}
  Teléfono: {{telefono}}
  Servicio: {{servicio}}
  
  {{mensaje}}';
  ALTER TABLE "configuracion" ADD COLUMN "plantillas_consulta_web_boton" varchar DEFAULT 'Ver la consulta';
  ALTER TABLE "servicios_puntos" ADD CONSTRAINT "servicios_puntos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."servicios"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "web_profesionales" ADD CONSTRAINT "web_profesionales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "web_sedes" ADD CONSTRAINT "web_sedes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "web_emails_consultas" ADD CONSTRAINT "web_emails_consultas_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "web" ADD CONSTRAINT "web_portada_imagen_id_media_id_fk" FOREIGN KEY ("portada_imagen_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "servicios_puntos_order_idx" ON "servicios_puntos" USING btree ("_order");
  CREATE INDEX "servicios_puntos_parent_id_idx" ON "servicios_puntos" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "servicios_slug_idx" ON "servicios" USING btree ("slug");
  CREATE INDEX "servicios_area_idx" ON "servicios" USING btree ("area");
  CREATE INDEX "servicios_publicado_idx" ON "servicios" USING btree ("publicado");
  CREATE INDEX "servicios_updated_at_idx" ON "servicios" USING btree ("updated_at");
  CREATE INDEX "servicios_created_at_idx" ON "servicios" USING btree ("created_at");
  CREATE INDEX "trabajos_area_idx" ON "trabajos" USING btree ("area");
  CREATE INDEX "trabajos_publicado_idx" ON "trabajos" USING btree ("publicado");
  CREATE INDEX "trabajos_updated_at_idx" ON "trabajos" USING btree ("updated_at");
  CREATE INDEX "trabajos_created_at_idx" ON "trabajos" USING btree ("created_at");
  CREATE INDEX "consultas_estado_idx" ON "consultas" USING btree ("estado");
  CREATE INDEX "consultas_ip_idx" ON "consultas" USING btree ("ip");
  CREATE INDEX "consultas_updated_at_idx" ON "consultas" USING btree ("updated_at");
  CREATE INDEX "consultas_created_at_idx" ON "consultas" USING btree ("created_at");
  CREATE INDEX "web_profesionales_order_idx" ON "web_profesionales" USING btree ("_order");
  CREATE INDEX "web_profesionales_parent_id_idx" ON "web_profesionales" USING btree ("_parent_id");
  CREATE INDEX "web_sedes_order_idx" ON "web_sedes" USING btree ("_order");
  CREATE INDEX "web_sedes_parent_id_idx" ON "web_sedes" USING btree ("_parent_id");
  CREATE INDEX "web_emails_consultas_order_idx" ON "web_emails_consultas" USING btree ("_order");
  CREATE INDEX "web_emails_consultas_parent_id_idx" ON "web_emails_consultas" USING btree ("_parent_id");
  CREATE INDEX "web_portada_portada_imagen_idx" ON "web" USING btree ("portada_imagen_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_servicios_fk" FOREIGN KEY ("servicios_id") REFERENCES "public"."servicios"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_trabajos_fk" FOREIGN KEY ("trabajos_id") REFERENCES "public"."trabajos"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_consultas_fk" FOREIGN KEY ("consultas_id") REFERENCES "public"."consultas"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_servicios_id_idx" ON "payload_locked_documents_rels" USING btree ("servicios_id");
  CREATE INDEX "payload_locked_documents_rels_trabajos_id_idx" ON "payload_locked_documents_rels" USING btree ("trabajos_id");
  CREATE INDEX "payload_locked_documents_rels_consultas_id_idx" ON "payload_locked_documents_rels" USING btree ("consultas_id");

-- 20261119_102254_esquema_pendiente
CREATE TABLE "videos" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "web_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"videos_id" integer
  );
  
  ALTER TABLE "configuracion" ALTER COLUMN "plantillas_resumen_semanal_asunto" SET DEFAULT 'Resumen semanal: {{total}} documentos en amarillo o rojo';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "videos_id" integer;
  ALTER TABLE "web_rels" ADD CONSTRAINT "web_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."web"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "web_rels" ADD CONSTRAINT "web_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "videos_updated_at_idx" ON "videos" USING btree ("updated_at");
  CREATE INDEX "videos_created_at_idx" ON "videos" USING btree ("created_at");
  CREATE UNIQUE INDEX "videos_filename_idx" ON "videos" USING btree ("filename");
  CREATE INDEX "web_rels_order_idx" ON "web_rels" USING btree ("order");
  CREATE INDEX "web_rels_parent_idx" ON "web_rels" USING btree ("parent_id");
  CREATE INDEX "web_rels_path_idx" ON "web_rels" USING btree ("path");
  CREATE INDEX "web_rels_videos_id_idx" ON "web_rels" USING btree ("videos_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_videos_fk" FOREIGN KEY ("videos_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "payload_locked_documents_rels" USING btree ("videos_id");

-- 20261120_101900_antelacion_empresa
ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "antelacion_meses" numeric
