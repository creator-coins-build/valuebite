/**
 * Live per-ZIP data: fetches Taco Bell + Domino's menus and coupons directly
 * from the chains' official ordering endpoints for the stores nearest a ZIP.
 * No database, no scraping beyond the same official feeds the daily refresh
 * uses. Results are cached in-memory per ZIP (single Render instance).
 *
 * Chains without a free per-store feed (Chick-fil-A, Burger King, Chipotle)
 * are NOT fetched here; their national-estimate rows come from the snapshot
 * and stay labeled "~" everywhere.
 */
import { TacoBellAdapter, exclusiveDeals } from "../adapters/tacobell";
import { DominosAdapter, normalizeCoupons } from "../adapters/dominos";
import { resolveStores } from "../location/resolve";
import type { NormalizedItem } from "../adapters/types";
import type { RankableRow, DealRow } from "../db/queries";

const TTL_MS = 3 * 3600_000;

export interface LiveStore { slug: string; address: string }
export interface LiveLocal {
  rows: RankableRow[];
  deals: DealRow[];
  stores: LiveStore[];
  errors: string[];
}

const cache = new Map<string, { at: number; data: LiveLocal }>();

function itemToRow(i: NormalizedItem, restaurantName: string): RankableRow {
  return {
    restaurantSlug: i.restaurantSlug,
    restaurantName,
    productId: i.productId,
    name: i.name,
    category: i.category,
    price: i.price,
    pricingType: i.pricingType,
    calories: i.calories,
    caloriesMin: i.caloriesMin ?? null,
    caloriesMax: i.caloriesMax ?? null,
    proteinG: i.proteinG,
    imageUrl: i.imageUrl ?? null,
    priceSourceUrl: i.priceSourceUrl,
    nutritionSourceUrl: i.nutritionSourceUrl,
    fetchedAt: i.fetchedAt,
  };
}

export async function fetchLiveLocal(zip: string): Promise<LiveLocal> {
  const hit = cache.get(zip);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const rows: RankableRow[] = [];
  const deals: DealRow[] = [];
  const stores: LiveStore[] = [];
  const errors: string[] = [];

  const resolved = await resolveStores(zip);

  const tb = resolved["taco-bell"]?.[0];
  if (tb) {
    try {
      const fetchedAt = new Date();
      const sourceUrl = `https://www.tacobell.com/tacobellwebservices/v4/tacobell/products/menu/${tb.storeId}`;
      const ctx = { storeId: tb.storeId, zip, fetchedAt, sourceUrl };
      const raw = await TacoBellAdapter.fetchMenu({ storeId: tb.storeId });
      const items = TacoBellAdapter.normalizeItems(raw, ctx);
      rows.push(...items.filter((i) => Number.isFinite(i.price)).map((i) => itemToRow(i, "Taco Bell")));
      for (const x of exclusiveDeals(raw)) {
        deals.push({
          restaurantName: "Taco Bell", title: x.name, price: x.price, promoCode: null,
          expiresAt: null, lastVerified: fetchedAt.toISOString(), sourceUrl,
          appOnly: x.kind === "app", redemption: x.kind,
        });
      }
      stores.push({ slug: "taco-bell", address: tb.address });
    } catch (e) {
      errors.push(`taco-bell: ${String(e)}`);
    }
  } else {
    errors.push("taco-bell: no store near this ZIP");
  }

  const dm = resolved.dominos?.[0];
  if (dm) {
    try {
      const fetchedAt = new Date();
      const sourceUrl = `https://order.dominos.com/power/store/${dm.storeId}/menu?lang=en&structured=true`;
      const ctx = { storeId: dm.storeId, zip, fetchedAt, sourceUrl };
      const raw = await DominosAdapter.fetchMenu({ storeId: dm.storeId });
      const items = DominosAdapter.normalizeItems(raw, ctx);
      rows.push(...items.filter((i) => Number.isFinite(i.price)).map((i) => itemToRow(i, "Domino's")));
      for (const c of normalizeCoupons(raw, ctx)) {
        if (c.expiresOn && new Date(c.expiresOn) <= fetchedAt) continue;
        deals.push({
          restaurantName: "Domino's", title: c.name, price: c.price, promoCode: c.code,
          expiresAt: c.expiresOn ? new Date(c.expiresOn).toISOString() : null,
          lastVerified: c.lastChecked, sourceUrl: c.sourceUrl, appOnly: false, redemption: null,
        });
      }
      stores.push({ slug: "dominos", address: dm.address });
    } catch (e) {
      errors.push(`dominos: ${String(e)}`);
    }
  } else {
    errors.push("dominos: no store near this ZIP");
  }

  const data: LiveLocal = { rows, deals, stores, errors };
  cache.set(zip, { at: Date.now(), data });
  return data;
}
