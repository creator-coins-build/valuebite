import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RankableRow, DealRow } from "./queries";

/**
 * Static snapshot reader. When data/snapshot.json exists (written by
 * scripts/export-snapshot.ts at build time), pages serve from it instead of
 * opening PGlite - keeps the hosted server well under 512Mi.
 */

export interface Snapshot {
  zip: string;
  generatedAt: string;
  rows: RankableRow[];
  deals: DealRow[];
}

let cache: Snapshot | null | undefined;

export function readSnapshot(): Snapshot | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(readFileSync(join(process.cwd(), "data", "snapshot.json"), "utf8")) as Snapshot;
  } catch {
    cache = null;
  }
  return cache;
}
