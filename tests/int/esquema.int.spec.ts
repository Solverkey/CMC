// @vitest-environment node
import { readFileSync } from 'fs'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, it } from 'vitest'
import { aSqlite, sentencias } from '@/lib/esquema'
import { hitoDeHoy } from '@/lib/avisos'
import { calcularEstado } from '@/lib/estado'

describe('esquema de la base (npm run seed)', () => {
  it('parte las sentencias sin romper los textos que llevan «;»', () => {
    const lista = sentencias(`CREATE TABLE a (x varchar DEFAULT 'uno; dos');\n-- comentario; con punto y coma\nCREATE TABLE b (y varchar DEFAULT 'l''eau');`)
    expect(lista).toHaveLength(2)
    expect(lista[0]).toContain("'uno; dos'")
    expect(lista[1]).toContain("'l''eau'")
  })

  it('traduce a SQLite y descarta lo que SQLite no necesita', () => {
    expect(aSqlite(`CREATE TYPE "public"."enum_x" AS ENUM('a')`)).toBeNull()
    expect(aSqlite(`ALTER TABLE "a" ADD CONSTRAINT "fk" FOREIGN KEY ("b") REFERENCES "public"."b"("id")`)).toBeNull()
    const t = aSqlite(`CREATE TABLE "d" ("id" serial PRIMARY KEY NOT NULL, "e" "enum_d_e", "ok" boolean DEFAULT true, "f" timestamp(3) with time zone DEFAULT now() NOT NULL)`)!
    expect(t).toContain('IF NOT EXISTS')
    expect(t).toContain('"id" integer PRIMARY KEY')
    expect(t).toContain('"e" text')
    expect(t).toContain('integer DEFAULT 1')
    expect(t).not.toMatch(/now\(\)|timestamp|enum_/)
    expect(aSqlite(`CREATE INDEX "i" ON "d" USING btree ("e")`)).toBe(`CREATE INDEX IF NOT EXISTS "i" ON "d" ("e")`)
  })

  it('el esquema completo se crea en un SQLite vacío con las tablas que usa el código', () => {
    const db = new DatabaseSync(':memory:')
    for (const s of sentencias(readFileSync('src/esquema/postgres.sql', 'utf8'))) {
      const sql = aSqlite(s)
      if (sql) db.exec(sql)
    }
    const tablas = new Set((db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((t) => t.name))
    for (const t of ['users', 'users_sessions', 'users_empresas', 'empresas', 'categorias', 'documentos', 'archivos', 'envios', 'hilos', 'mensajes', 'mensajes_rels', 'adjuntos', 'catalogo', 'correos', 'actividad', 'configuracion', 'payload_mcp_api_keys', 'oauth_clientes', 'oauth_codigos', 'servicios', 'trabajos', 'web', 'videos']) {
      expect(tablas, t).toContain(t)
    }
    const empresas = (db.prepare('PRAGMA table_info(empresas)').all() as { name: string }[]).map((c) => c.name)
    expect(empresas).toContain('antelacion_meses')
  })
})

describe('avisos alineados con el semáforo', () => {
  const cfg = { recordatorioDiasAntes: 15, frecuenciaCaducado: 'semanal' as const, maxRecordatoriosCaducado: 3 }
  it('el día de la caducidad el documento no está rojo ni se avisa de «caducado»; al día siguiente, ambas cosas', () => {
    const doc = { fechaCaducidad: '2026-06-15T00:00:00', fechaAviso: '2026-04-15T00:00:00' }
    const ese = new Date('2026-06-15T10:00:00')
    const siguiente = new Date('2026-06-16T10:00:00')
    expect(calcularEstado(doc, ese)).not.toBe('rojo')
    expect(hitoDeHoy(doc, cfg, ese)?.tipo).not.toBe('caducado')
    expect(calcularEstado(doc, siguiente)).toBe('rojo')
    expect(hitoDeHoy(doc, cfg, siguiente)?.tipo).toBe('caducado')
  })
})
