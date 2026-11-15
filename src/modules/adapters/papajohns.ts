import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedItem } from "./types";
import type { RankableRow, DealRow } from "../db/queries";

/**
 * Papa John's: official per-store data from the chain's own public ordering
 * site (papajohns.com). The site is a Next.js app whose frontend calls
 * same-origin tRPC endpoints; these are the exact calls the public menu,
 * store-search and deals pages make, observed in a real browser session:
 *
 *   POST /api/trpc/stores.searchStores   {postalCode, searchType:"CARRYOUT"}
 *   GET  /api/trpc/product.getByStore    {storeId}
 *   GET  /api/trpc/deals.getByStore      {storeId, isDesktop:true}
 *
 * Akamai's edge refuses non-browser clients, so these cannot be fetched from
 * the hosted server. Per-ZIP snapshots are captured through a real browser
 * session during the browser-based refresh and committed under
 * data/papajohns/<zip>.json. A ZIP without a committed snapshot has no Papa
 * John's rows at all - never another store's prices under its name.
 *
 * Nutrition units: the feed reports pizza calories PER SLICE with a
 * servingLabel like "/slice, 6 slices". Whole-item calories = calories x
 * slices. Other per-portion counts use published piece counts; ambiguous units stay unknown.
 * Protein is not in the feed, so PJ rows stay out of the protein-based
 * Value Score ranking (unknown stays unknown).
 */

export const PAPA_JOHNS_SLUG = "papajohns";
export const PAPA_JOHNS_NAME = "Papa John's";
const MENU_URL = "https://www.papajohns.com/order/menu";
const SITE = "https://www.papajohns.com";

export interface PJProduct {
  name: string;
  sku: string;
  cat: string | null;
  price: string;
  regular: string;
  calories: number | null;
  servingLabel: string;
  desc: string;
  image: string | null;
}

export interface PJDeal {
  id: number;
  title: string;
  offerCode: string | null;
  desc: string;
  price: string;
  regular: string;
  image: string | null;
}

export interface PapaJohnsSnapshot {
  fetchedAt: string;
  zip: string;
  storeId: number;
  storeAddress: string;
  source: string;
  products: PJProduct[];
  deals: PJDeal[];
}

/** Papa John's category ids -> ValueBite category codes (drinks/sweets/sauces stay excluded from entree rankings). */
const CATEGORY_MAP: Record<string, string> = {
  pizza: "pizza",
  sandwiches: "sandwiches",
  wings: "wings",
  papabowls: "bowls",
  sides: "sides",
  desserts: "sweets",
  drinks: "drinks",
  dippingsauces: "sauces",
  extras: "sauces",
};

const PORTIONS_RE = /^\/(?:slice|square|stick|piece|knot),\s*(\d+)\s*(?:slices|squares|sticks|pieces|knots)$/i;

/** Whole-item calories: per-slice counts are multiplied by the official slice count. */
export function wholeCalories(p: Pick<PJProduct, "calories" | "servingLabel"> & { name?: string }): number | null {
  if (p.calories === null || !Number.isFinite(p.calories)) return null;
  const label = p.servingLabel ?? "";
  const m = PORTIONS_RE.exec(label);
  if (m) return p.calories * Number(m[1]);
  // Blank label is only safe for individually named sandwiches. Other blank
  // labels (e.g. multi-piece wings) and per-ounce drinks stay unknown.
  return label === "" && /Oven-Toasted Sandwich/i.test((p as PJProduct).name ?? "") ? p.calories : null;
}

function parsePrice(s: string): number | null {
  const n = Number(s);
  return s !== "" && Number.isFinite(n) && n > 0 ? n : null;
}

const cache = new Map<string, PapaJohnsSnapshot | null>();

export function isFresh(snap: PapaJohnsSnapshot, now = Date.now()): boolean {
  const age = now - Date.parse(snap.fetchedAt);
  return age >= 0 && age < 48 * 3600_000;
}

/** Committed snapshot for a ZIP, or null when this ZIP has no Papa John's coverage. */
export function loadSnapshot(zip: string): PapaJohnsSnapshot | null {
  if (!/^\d{5}$/.test(zip)) return null;
  if (cache.has(zip)) {
    const hit = cache.get(zip)!;
    return hit && isFresh(hit) ? hit : null;
  }
  let snap: PapaJohnsSnapshot | null = null;
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "papajohns", `${zip}.json`), "utf8")) as PapaJohnsSnapshot;
    if (raw && Array.isArray(raw.products) && raw.storeAddress && raw.zip === zip) snap = raw;
  } catch {
    snap = null;
  }
  cache.set(zip, snap);
  return snap && isFresh(snap) ? snap : null;
}

export function normalizeItems(snap: PapaJohnsSnapshot): NormalizedItem[] {
  const fetchedAt = snap.fetchedAt;
  return snap.products.flatMap((p) => {
    const price = parsePrice(p.price);
    if (price === null) return [];
    const image = p.image ? (p.image.startsWith("http") ? p.image : `${SITE}${p.image}`) : null;
    return [{
      restaurantSlug: PAPA_JOHNS_SLUG,
      productId: p.sku,
      name: p.name,
      description: p.desc || null,
      category: CATEGORY_MAP[p.cat ?? ""] ?? p.cat ?? "other",
      calories: wholeCalories(p),
      proteinG: null, // not in the feed - unknown stays unknown
      imageUrl: image,
      nutritionSourceUrl: MENU_URL,
      nutritionConfidence: "high" as const,
      price,
      pricingType: "exact_store" as const,
      priceSourceUrl: MENU_URL,
      storeId: String(snap.storeId),
      zip: snap.zip,
      fetchedAt,
    }];
  });
}

export function itemRows(snap: PapaJohnsSnapshot): RankableRow[] {
  return normalizeItems(snap).map((i) => ({
    restaurantSlug: i.restaurantSlug,
    restaurantName: PAPA_JOHNS_NAME,
    productId: i.productId,
    name: i.name,
    category: i.category,
    price: i.price,
    pricingType: i.pricingType,
    calories: i.calories,
    caloriesMin: null,
    caloriesMax: null,
    proteinG: i.proteinG,
    imageUrl: i.imageUrl ?? null,
    priceSourceUrl: i.priceSourceUrl,
    nutritionSourceUrl: i.nutritionSourceUrl,
    fetchedAt: i.fetchedAt,
  }));
}

export function dealRows(snap: PapaJohnsSnapshot): DealRow[] {
  return snap.deals.map((d) => ({
    restaurantName: PAPA_JOHNS_NAME,
    title: d.title,
    price: parsePrice(d.price),
    promoCode: d.offerCode,
    expiresAt: null, // the feed gives no expiry; freshness comes from the snapshot's fetchedAt
    lastVerified: snap.fetchedAt,
    sourceUrl: "https://www.papajohns.com/order/specials",
    appOnly: false,
    redemption: "online",
  }));
}
