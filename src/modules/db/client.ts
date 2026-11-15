import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";

// PGlite is loaded lazily inside openDb: on the hosted 512Mi server the pages
// serve from data/snapshot.json and never touch this module's WASM at all.

/**
 * Dev persistence: PGlite (embedded Postgres in WASM). The sandbox has no
 * Postgres server; PGlite runs the real drizzle migration unchanged, so the
 * same schema works against a hosted Postgres later.
 */

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../../drizzle");

import type { PgliteDatabase } from "drizzle-orm/pglite";
export type Db = PgliteDatabase<typeof schema>;

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
  const [{ PGlite }, { drizzle }] = await Promise.all([import("@electric-sql/pglite"), import("drizzle-orm/pglite")]);
  const client = new PGlite(dataDir);
  await client.waitReady;
  await migrate(client);
  return { db: drizzle({ client, schema }), client };
}
