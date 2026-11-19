import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Vídeos de portada. Los valores nuevos del semáforo ya los añadieron las migraciones 20261117_*. */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
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
  CREATE INDEX "payload_locked_documents_rels_videos_id_idx" ON "payload_locked_documents_rels" USING btree ("videos_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "videos" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "web_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "videos" CASCADE;
  DROP TABLE "web_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_videos_fk";
  
  ALTER TABLE "documentos" ALTER COLUMN "estado" SET DATA TYPE text;
  DROP TYPE "public"."enum_documentos_estado";
  CREATE TYPE "public"."enum_documentos_estado" AS ENUM('verde', 'amarillo', 'naranja', 'rojo', 'negro');
  ALTER TABLE "documentos" ALTER COLUMN "estado" SET DATA TYPE "public"."enum_documentos_estado" USING "estado"::"public"."enum_documentos_estado";
  ALTER TABLE "documentos" ALTER COLUMN "estado_manual" SET DATA TYPE text;
  DROP TYPE "public"."enum_documentos_estado_manual";
  CREATE TYPE "public"."enum_documentos_estado_manual" AS ENUM('amarillo', 'rojo', 'negro');
  ALTER TABLE "documentos" ALTER COLUMN "estado_manual" SET DATA TYPE "public"."enum_documentos_estado_manual" USING "estado_manual"::"public"."enum_documentos_estado_manual";
  DROP INDEX "payload_locked_documents_rels_videos_id_idx";
  ALTER TABLE "configuracion" ALTER COLUMN "plantillas_resumen_semanal_asunto" SET DEFAULT 'Resumen semanal: {{total}} documentos en naranja o rojo';
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "videos_id";`)
}
