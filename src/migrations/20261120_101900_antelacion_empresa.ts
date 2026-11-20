import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/** Antelación de aviso estándar de cada cliente. Vacío = la de la plataforma. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "empresas" ADD COLUMN IF NOT EXISTS "antelacion_meses" numeric`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "empresas" DROP COLUMN IF EXISTS "antelacion_meses"`)
}
