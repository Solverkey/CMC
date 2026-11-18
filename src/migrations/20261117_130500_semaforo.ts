import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Nuevos valores del semáforo. Van solos: Postgres no deja usar un valor de enum en la misma transacción en que se crea. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TYPE "public"."enum_documentos_estado" ADD VALUE IF NOT EXISTS 'azul';
  ALTER TYPE "public"."enum_documentos_estado_manual" ADD VALUE IF NOT EXISTS 'naranja';
  ALTER TYPE "public"."enum_documentos_estado_manual" ADD VALUE IF NOT EXISTS 'azul';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  -- Postgres no permite quitar un valor de un enum sin recrear el tipo.
  SELECT 1;
  `)
}
