import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
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
  CREATE INDEX "payload_locked_documents_rels_consultas_id_idx" ON "payload_locked_documents_rels" USING btree ("consultas_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "servicios_puntos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "servicios" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "trabajos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "consultas" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "web_profesionales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "web_sedes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "web_emails_consultas" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "web" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "servicios_puntos" CASCADE;
  DROP TABLE "servicios" CASCADE;
  DROP TABLE "trabajos" CASCADE;
  DROP TABLE "consultas" CASCADE;
  DROP TABLE "web_profesionales" CASCADE;
  DROP TABLE "web_sedes" CASCADE;
  DROP TABLE "web_emails_consultas" CASCADE;
  DROP TABLE "web" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_servicios_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_trabajos_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_consultas_fk";
  
  ALTER TABLE "actividad" ALTER COLUMN "accion" SET DATA TYPE text;
  DROP TYPE "public"."enum_actividad_accion";
  CREATE TYPE "public"."enum_actividad_accion" AS ENUM('login', 'login_fallido', 'logout', 'alta', 'edicion', 'baja', 'subida', 'descarga', 'cambio_estado', 'envio', 'publicacion', 'rechazo', 'mensaje', 'correo', 'correo_enviado', 'correo_entregado', 'correo_abierto', 'correo_rebotado', 'correo_error', 'permisos', 'seguridad', 'exportacion');
  ALTER TABLE "actividad" ALTER COLUMN "accion" SET DATA TYPE "public"."enum_actividad_accion" USING "accion"::"public"."enum_actividad_accion";
  DROP INDEX "payload_locked_documents_rels_servicios_id_idx";
  DROP INDEX "payload_locked_documents_rels_trabajos_id_idx";
  DROP INDEX "payload_locked_documents_rels_consultas_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "servicios_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "trabajos_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "consultas_id";
  ALTER TABLE "configuracion" DROP COLUMN "plantillas_consulta_web_asunto";
  ALTER TABLE "configuracion" DROP COLUMN "plantillas_consulta_web_cuerpo";
  ALTER TABLE "configuracion" DROP COLUMN "plantillas_consulta_web_boton";
  DROP TYPE "public"."enum_servicios_area";
  DROP TYPE "public"."enum_trabajos_area";
  DROP TYPE "public"."enum_consultas_estado";`)
}
