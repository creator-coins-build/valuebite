import { openDb } from "../modules/db/client";
import { rankableRows, activeDeals } from "../modules/db/queries";
import { readSnapshot } from "../modules/db/snapshot";
import { loadSnapshot as loadPapaJohns, itemRows as papaJohnsRows, dealRows as papaJohnsDeals, coveredZips as papaJohnsZips, PAPA_JOHNS_SLUG, PAPA_JOHNS_NAME } from "../modules/adapters/papajohns";
import { loadSnapshot as loadPizzaHut, itemRows as pizzaHutRows, dealRows as pizzaHutDeals, coveredZips as pizzaHutZips, PIZZA_HUT_SLUG, PIZZA_HUT_NAME } from "../modules/adapters/pizzahut";

/** Browser-captured per-store snapshot chains: exact rows only for ZIPs with a fresh committed snapshot. */
function snapshotChains(zip: string) {
  const out = { rows: [] as import("../modules/db/queries").RankableRow[], deals: [] as import("../modules/db/queries").DealRow[], stores: [] as { slug: string; address: string; asOf: string }[], missing: [] as string[] };
  const pj = loadPapaJohns(zip);
  if (pj) {
    out.rows.push(...papaJohnsRows(pj)); out.deals.push(...papaJohnsDeals(pj));
    out.stores.push({ slug: PAPA_JOHNS_SLUG, address: pj.storeAddress, asOf: pj.fetchedAt.slice(0, 10) });
  } else out.missing.push(`${PAPA_JOHNS_NAME}: no local snapshot; covered ZIPs: ${papaJohnsZips().join(", ") || "none"}`);
  const ph = loadPizzaHut(zip);
  if (ph) {
    out.rows.push(...pizzaHutRows(ph)); out.deals.push(...pizzaHutDeals(ph));
    out.stores.push({ slug: PIZZA_HUT_SLUG, address: ph.storeAddress, asOf: ph.fetchedAt.slice(0, 10) });
  } else out.missing.push(`${PIZZA_HUT_NAME}: no local snapshot; covered ZIPs: ${pizzaHutZips().join(", ") || "none"}`);
  return out;
}
import { scorePopulation, rank as rankScores } from "../modules/scoring/engine";
import { entrees } from "../modules/scoring/rank";
import type { RankableRow } from "../modules/db/queries";

export const ZIP = "33613";

/** Chains with exact per-store, ZIP-specific data (never carried across ZIPs as national estimates). */
const LIVE_SLUGS = new Set(["taco-bell", "dominos", PAPA_JOHNS_SLUG, PIZZA_HUT_SLUG]);

export interface LoadedData {
  rows: import("../modules/db/queries").RankableRow[];
  deals: import("../modules/db/queries").DealRow[];
  checked: string;
  /** The ZIP the data actually represents. */
  zip: string;
  /** Store addresses behind exact prices. asOf marks a dated browser-captured snapshot (not a live fetch). */
  stores: { slug: string; address: string; asOf?: string }[];
  /** true when Taco Bell/Domino's rows+deals were fetched live for a non-default ZIP. */
  live: boolean;
  liveErrors: string[];
  /** The ZIP the user asked for, when valid. */
  requestedZip: string | null;
  /** true when the requested ZIP could not be loaded and default-ZIP data is shown instead. */
  fellBack: boolean;
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
        // Snapshot chains: exact only from a committed browser-captured snapshot for THIS zip.
        const sc = snapshotChains(zip);
        return {
          rows: [...live.rows, ...sc.rows, ...estimates],
          deals: [...live.deals, ...sc.deals],
          checked: new Date().toISOString().slice(0, 10),
          zip,
          stores: [...live.stores, ...sc.stores],
          live: true,
          liveErrors: [...live.errors, ...sc.missing],
          requestedZip: zip, fellBack: false,
        };
      }
    } catch {
      // fall through to the snapshot ZIP rather than showing nothing
    }
    return {
      rows: snap.rows, deals: snap.deals, checked: snap.generatedAt.slice(0, 10),
      zip: snap.zip, stores: [], live: false, liveErrors: ["live fetch failed - showing default ZIP"], requestedZip: zip, fellBack: true,
    };
  }

  if (snap) {
    // Default-ZIP view: add snapshot chains when a committed snapshot covers this ZIP, with freshness.
    const sc = snapshotChains(snap.zip);
    return {
      rows: [...snap.rows, ...sc.rows],
      deals: [...snap.deals, ...sc.deals],
      checked: snap.generatedAt.slice(0, 10), zip: snap.zip,
      stores: sc.stores,
      live: false, liveErrors: [], requestedZip: zip, fellBack: false,
    };
  }
  const { db, client } = await openDb("./data/pgdb");
  const rows = await rankableRows(db, ZIP);
  const deals = await activeDeals(db);
  await client.close();
  return { rows, deals, checked: new Date().toISOString().slice(0, 10), zip: ZIP, stores: [], live: false, liveErrors: [], requestedZip: null, fellBack: false };
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
