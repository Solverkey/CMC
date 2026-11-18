import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Amarillo pasa a ser caducidad próxima y naranja, condicionada.
 * El negro anterior (no aplica) pasa a azul (pasado o archivado). El negro nuevo significa no legalizado.
 * Las categorías de ejemplo ISO y OCA pasan a tipos de instalación.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "documentos" SET "estado" = CASE "estado"
    WHEN 'amarillo' THEN 'naranja'
    WHEN 'naranja' THEN 'amarillo'
    ELSE "estado"
  END;
  UPDATE "documentos" SET "estado" = 'azul' WHERE "estado" = 'negro';
  UPDATE "documentos" SET "estado_manual" = 'naranja' WHERE "estado_manual" = 'amarillo';
  UPDATE "documentos" SET "estado_manual" = 'azul' WHERE "estado_manual" = 'negro';
  UPDATE "categorias" SET "nombre" = 'Alta tensión' WHERE "nombre" = 'Certificados ISO';
  UPDATE "categorias" SET "nombre" = 'Baja tensión' WHERE "nombre" = 'Inspecciones OCA';
  UPDATE "documentos" SET "categoria_id" = (
    SELECT b.id FROM "categorias" b
    WHERE b.empresa_id = (SELECT c.empresa_id FROM "categorias" c WHERE c.id = "documentos"."categoria_id")
      AND b.nombre = 'Baja tensión'
    LIMIT 1
  )
  WHERE "categoria_id" IN (SELECT id FROM "categorias" WHERE "nombre" IN ('Licencias', 'Proyectos'));
  DELETE FROM "categorias" WHERE "nombre" IN ('Licencias', 'Proyectos');
  UPDATE "catalogo" SET "nombre" = 'Alta tensión', "normalizado" = 'alta tension' WHERE "tipo" = 'categoria' AND "nombre" = 'Certificados ISO';
  UPDATE "catalogo" SET "nombre" = 'Baja tensión', "normalizado" = 'baja tension' WHERE "tipo" = 'categoria' AND "nombre" = 'Inspecciones OCA';
  DELETE FROM "catalogo" WHERE "tipo" = 'categoria' AND "nombre" IN ('Licencias', 'Proyectos', 'Certificados ISO', 'Inspecciones OCA');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  UPDATE "documentos" SET "estado" = 'negro' WHERE "estado" = 'azul';
  UPDATE "documentos" SET "estado" = CASE "estado"
    WHEN 'amarillo' THEN 'naranja'
    WHEN 'naranja' THEN 'amarillo'
    ELSE "estado"
  END;
  UPDATE "documentos" SET "estado_manual" = 'negro' WHERE "estado_manual" = 'azul';
  UPDATE "documentos" SET "estado_manual" = 'amarillo' WHERE "estado_manual" = 'naranja';
  UPDATE "categorias" SET "nombre" = 'Certificados ISO' WHERE "nombre" = 'Alta tensión';
  UPDATE "categorias" SET "nombre" = 'Inspecciones OCA' WHERE "nombre" = 'Baja tensión';
  UPDATE "catalogo" SET "nombre" = 'Certificados ISO', "normalizado" = 'certificados iso' WHERE "tipo" = 'categoria' AND "nombre" = 'Alta tensión';
  UPDATE "catalogo" SET "nombre" = 'Inspecciones OCA', "normalizado" = 'inspecciones oca' WHERE "tipo" = 'categoria' AND "nombre" = 'Baja tensión';
  `)
}
