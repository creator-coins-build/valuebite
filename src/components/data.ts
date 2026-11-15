import { openDb } from "../modules/db/client";
import { rankableRows, activeDeals } from "../modules/db/queries";
import { readSnapshot } from "../modules/db/snapshot";
import { scorePopulation, rank as rankScores } from "../modules/scoring/engine";
import { entrees } from "../modules/scoring/rank";
import type { RankableRow } from "../modules/db/queries";

export const ZIP = "33613";

/** Snapshot-first data load (hosted serves the committed snapshot; PGlite only for local dev). */
export async function loadData() {
  const snap = readSnapshot();
  if (snap) {
    return { rows: snap.rows, deals: snap.deals, checked: snap.generatedAt.slice(0, 10) };
  }
  const { db, client } = await openDb("./data/pgdb");
  const rows = await rankableRows(db, ZIP);
  const deals = await activeDeals(db);
  await client.close();
  return { rows, deals, checked: new Date().toISOString().slice(0, 10) };
}

export interface ScoredRow {
  row: RankableRow;
  score: number;
}

/** Rank entrees by Value Score V1. Unknown-protein rows get no score and drop out of ranking. */
export function rankEntrees(rows: RankableRow[]): ScoredRow[] {
  const normalized = rows.map((r) => ({ ...r, category: r.category ?? "" }));
  const scored = scorePopulation(
    normalized.map((r) => ({ id: `${r.restaurantSlug}:${r.productId}`, price: r.price, calories: r.calories, protein: r.proteinG })),
  );
  const byId = new Map(normalized.map((r) => [`${r.restaurantSlug}:${r.productId}`, r]));
  const entreeKeys = new Set(entrees(normalized).map((r) => `${r.restaurantSlug}:${r.productId}`));
  return rankScores(scored, "value")
    .map((s) => ({ row: byId.get(s.id)!, score: s.valueScore }))
    .filter(({ row, score }) => row !== undefined && score !== null && entreeKeys.has(`${row.restaurantSlug}:${row.productId}`)) as ScoredRow[];
}
