/**
 * La web entra a Postgres como propietaria. La API REST de Supabase, con la clave
 * anónima, no debe poder leer ni escribir ninguna tabla: ahí están contraseñas,
 * secretos de doble factor, tokens de recuperación y claves de los asistentes.
 * Activar RLS sin una política permisiva las cierra. El propietario sigue entrando.
 */

const BLOQUEO = `
DO $cerrar$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS nombre, c.relkind AS tipo
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm')
  LOOP
    BEGIN
      IF r.tipo IN ('r', 'p') THEN
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.nombre);
        EXECUTE format('DROP POLICY IF EXISTS api_denegada ON public.%I', r.nombre);
        EXECUTE format(
          'CREATE POLICY api_denegada ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
          r.nombre
        );
      ELSIF r.tipo = 'v' THEN
        EXECUTE format('ALTER VIEW public.%I SET (security_invoker = true)', r.nombre);
      END IF;
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', r.nombre);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'cerrar api %: %', r.nombre, SQLERRM;
    END;
  END LOOP;

  FOR r IN
    SELECT c.relname AS nombre
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    BEGIN
      EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM PUBLIC, anon, authenticated', r.nombre);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'cerrar api secuencia %: %', r.nombre, SQLERRM;
    END;
  END LOOP;

  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated';
  EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated';
END
$cerrar$;
`

type Cliente = { unsafe: (consulta: string) => Promise<unknown> }

export async function cerrarApiPublica(sql: Cliente) {
  const roles = (await sql.unsafe(`SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') AS anon`)) as { anon: boolean }[]
  if (!roles[0]?.anon) return
  await sql.unsafe(`SET statement_timeout = '30s'`)
  try {
    await sql.unsafe(BLOQUEO)
    const abiertas = (await sql.unsafe(`
      SELECT c.relname AS tabla
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
      ORDER BY 1
    `)) as { tabla: string }[]
    if (abiertas.length) console.error('Siguen sin seguridad por fila:', abiertas.map((t) => t.tabla).join(', '))
  } finally {
    await sql.unsafe(`SET statement_timeout = '8s'`).catch(() => undefined)
  }
}
