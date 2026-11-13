import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

/**
 * Dev persistence: PGlite (embedded Postgres in WASM). The sandbox has no
 * Postgres server; PGlite runs the real drizzle migration unchanged, so the
 * same schema works against a hosted Postgres later.
 */

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

export type Db = ReturnType<typeof makeDb>;

function makeDb(client: PGlite) {
  return drizzle({ client, schema });
}

/** Applies every SQL migration in drizzle/ in filename order. Idempotent via a tracking table. */
async function migrate(client: PGlite): Promise<void> {
  await client.exec(`CREATE TABLE IF NOT EXISTS __valuebite_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const applied = new Set(
    (await client.query<{ name: string }>(`SELECT name FROM __valuebite_migrations`)).rows.map((r) => r.name),
  );
  for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    if (applied.has(f)) continue;
    await client.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
    await client.query(`INSERT INTO __valuebite_migrations (name) VALUES ($1)`, [f]);
  }
}

/** Open (or create) a database at dataDir. Use "memory://" in tests. */
export async function openDb(dataDir: string = "memory://"): Promise<{ db: Db; client: PGlite }> {
  const client = new PGlite(dataDir);
  await client.waitReady;
  await migrate(client);
  return { db: makeDb(client), client };
}
