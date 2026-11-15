import { openDb } from "../modules/db/client";
import { rankableRows, activeDeals } from "../modules/db/queries";
import { readSnapshot } from "../modules/db/snapshot";
import { scorePopulation, rank as rankScores } from "../modules/scoring/engine";
import { entrees } from "../modules/scoring/rank";
import type { RankableRow } from "../modules/db/queries";

export const ZIP = "33613";

/** Chains with exact per-store data that the live per-ZIP path re-fetches. */
const LIVE_SLUGS = new Set(["taco-bell", "dominos"]);

export interface LoadedData {
  rows: import("../modules/db/queries").RankableRow[];
  deals: import("../modules/db/queries").DealRow[];
  checked: string;
  /** The ZIP the data actually represents. */
  zip: string;
  /** Store addresses behind exact prices (live mode only). */
  stores: { slug: string; address: string }[];
  /** true when Taco Bell/Domino's rows+deals were fetched live for a non-default ZIP. */
  live: boolean;
  liveErrors: string[];
}

/** Snapshot-first data load (hosted serves the committed snapshot; PGlite only for local dev). */
export async function loadData(zipParam?: string): Promise<LoadedData> {
  const snap = readSnapshot();
  const zip = zipParam && /^\d{5}$/.test(zipParam) ? zipParam : null;

  if (snap && zip && zip !== snap.zip) {
    try {
      const { fetchLiveLocal } = await import("../modules/live/local");
      const live = await fetchLiveLocal(zip);
      if (live.rows.length > 0) {
        // Estimate chains are national (~) and ZIP-independent: keep them from the snapshot.
        const estimates = snap.rows.filter((r) => !LIVE_SLUGS.has(r.restaurantSlug));
        return {
          rows: [...live.rows, ...estimates],
          deals: live.deals,
          checked: new Date().toISOString().slice(0, 10),
          zip, stores: live.stores, live: true, liveErrors: live.errors,
        };
      }
    } catch {
      // fall through to the snapshot ZIP rather than showing nothing
    }
    return {
      rows: snap.rows, deals: snap.deals, checked: snap.generatedAt.slice(0, 10),
      zip: snap.zip, stores: [], live: false, liveErrors: ["live fetch failed - showing default ZIP"],
    };
  }

  if (snap) {
    return { rows: snap.rows, deals: snap.deals, checked: snap.generatedAt.slice(0, 10), zip: snap.zip, stores: [], live: false, liveErrors: [] };
  }
  const { db, client } = await openDb("./data/pgdb");
  const rows = await rankableRows(db, ZIP);
  const deals = await activeDeals(db);
  await client.close();
  return { rows, deals, checked: new Date().toISOString().slice(0, 10), zip: ZIP, stores: [], live: false, liveErrors: [] };
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
