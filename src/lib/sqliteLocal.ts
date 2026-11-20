import { DatabaseSync } from 'node:sqlite'
import path from 'path'

/**
 * SQLite local no ejecuta las migraciones de Postgres. La colección de vídeos
 * llegó después y el fichero se queda sin `videos` ni `videos_id`, y Payload
 * falla al leer los bloqueos. Solo crea lo que falta; no toca índices ya existentes.
 */
export function asegurarSqlite(url: string) {
  if (!url.startsWith('file:')) return
  const archivo = path.resolve(url.slice('file:'.length))
  const db = new DatabaseSync(archivo)
  const tablas = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name))
  const columnas = tablas.has('payload_locked_documents_rels')
    ? new Set((db.prepare('PRAGMA table_info(payload_locked_documents_rels)').all() as { name: string }[]).map((c) => c.name))
    : new Set<string>()

  if (!tablas.has('videos')) {
    db.exec(`
      CREATE TABLE videos (
        id integer PRIMARY KEY NOT NULL,
        alt text,
        updated_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
        created_at text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
        url text,
        thumbnail_u_r_l text,
        filename text,
        mime_type text,
        filesize numeric,
        width numeric,
        height numeric,
        focal_x numeric,
        focal_y numeric
      );
      CREATE INDEX videos_updated_at_idx ON videos (updated_at);
      CREATE INDEX videos_created_at_idx ON videos (created_at);
      CREATE UNIQUE INDEX videos_filename_idx ON videos (filename);
    `)
  }

  if (!tablas.has('web_rels')) {
    db.exec(`
      CREATE TABLE web_rels (
        id integer PRIMARY KEY NOT NULL,
        "order" integer,
        parent_id integer NOT NULL,
        path text NOT NULL,
        videos_id integer,
        FOREIGN KEY (parent_id) REFERENCES web(id) ON UPDATE no action ON DELETE cascade,
        FOREIGN KEY (videos_id) REFERENCES videos(id) ON UPDATE no action ON DELETE cascade
      );
      CREATE INDEX web_rels_order_idx ON web_rels ("order");
      CREATE INDEX web_rels_parent_idx ON web_rels (parent_id);
      CREATE INDEX web_rels_path_idx ON web_rels (path);
      CREATE INDEX web_rels_videos_id_idx ON web_rels (videos_id);
    `)
  }

  if (tablas.has('payload_locked_documents_rels') && !columnas.has('videos_id')) {
    db.exec(`
      ALTER TABLE payload_locked_documents_rels ADD COLUMN videos_id integer REFERENCES videos(id) ON DELETE cascade ON UPDATE no action;
      CREATE INDEX payload_locked_documents_rels_videos_id_idx ON payload_locked_documents_rels (videos_id);
    `)
  }

  if (tablas.has('empresas')) {
    const empresas = new Set((db.prepare('PRAGMA table_info(empresas)').all() as { name: string }[]).map((c) => c.name))
    if (!empresas.has('antelacion_meses')) db.exec('ALTER TABLE empresas ADD COLUMN antelacion_meses numeric')
  }

  db.close()
}
