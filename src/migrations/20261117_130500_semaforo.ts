import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/** Un solo valor por migración. Postgres no admite dos ALTER TYPE del mismo enum en una transacción, y eso tira la web en Vercel. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TYPE "public"."enum_documentos_estado" ADD VALUE IF NOT EXISTS 'azul'`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`SELECT 1`)
}
