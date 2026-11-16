import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedItem } from "./types";
import type { RankableRow, DealRow } from "../db/queries";

/**
 * Sonic: official per-store data from the chain's own public ordering site
 * (sonicdrivein.com). Menu item cards render name, price and calories only
 * after a store is picked through the public store-picker UI; the underlying
 * API is worker-gated behind PerimeterX, so snapshots are captured by
 * driving the rendered site in a real browser session (never API replay),
 * then committed under data/sonic/<zip>.json. A ZIP without a committed
 * snapshot has no Sonic rows at all - never another store's prices under
 * its name.
 *
 * Prices/calories are exactly what the item cards display for the default
 * shown size. Items the site renders as "View Item" with no price (not
 * orderable online at capture time) keep price unknown; items flagged
 * "Temporarily Unavailable" by the site are excluded from rows.
 * Protein is not published on the cards, so Sonic rows stay out of the
 * protein-based Value Score ranking (unknown stays unknown).
 */

export const SONIC_SLUG = "sonic";
export const SONIC_NAME = "Sonic";
const MENU_URL = "https://www.sonicdrivein.com/menu";

export interface SonicProduct {
  name: string;
  cat: string;
  href: string;
  priceCents: number | null;
  listPriceCents: number | null;
  cal: number | null;
  unavailable: boolean;
}

export interface SonicSnapshot {
  chain: "sonic";
  zip: string;
  store: { id: string | null; address: string };
  fetchedAt: string;
  source: string;
  note?: string;
  products: SonicProduct[];
}

/** Sonic menu categories -> ValueBite category codes (drinks/sweets/sauces stay excluded from entree rankings). */
const DRINK_CATS = new Set(["sodas", "slushes", "refreshers", "lemonades-limeades", "tea-coffee", "other-drinks"]);
const CATEGORY_MAP: Record<string, string> = {
  burgers: "burgers",
  chicken: "chicken",
  "hot-dogs": "hot-dogs",
  sandwiches: "sandwiches",
  "breakfast-all-day": "breakfast",
  combos: "combos",
  "snacks-sides": "sides",
  sweets: "sweets",
  "extra-sauces": "sauces",
  "wacky-pack-kids-meals": "kids",
};
const SWEET_OR_DRINK_NAME = /float|slush|shake|sundae|blast|soft serve|cone|soda|cola|dr pepper|lemonade|limeade|tea|coffee|juice|water/i;

export function categoryOf(p: SonicProduct): string {
  const sub = p.href.split("/")[4] ?? "";
  if (sub === "drinks" || sub === "breakfast-drinks") return "drinks";
  if (DRINK_CATS.has(p.cat)) return "drinks";
  if (p.cat === "value" || p.cat === "limited-time") {
    if (sub === "bundles" || sub === "value") return "combos"; // Big Deal Meals
    if (sub === "burgers") return "burgers";
    return SWEET_OR_DRINK_NAME.test(p.name) ? "sweets" : "value";
  }
  return CATEGORY_MAP[p.cat] ?? "other";
}

function slugOf(href: string): string {
  return href.replace(/\/+$/, "").split("/").pop() ?? href;
}

const cache = new Map<string, SonicSnapshot | null>();

export function isFresh(snap: SonicSnapshot, now = Date.now()): boolean {
  const age = now - Date.parse(snap.fetchedAt);
  return age >= 0 && age < 48 * 3600_000;
}

/** Committed snapshot for a ZIP, or null when this ZIP has no Sonic coverage. */
export function loadSnapshot(zip: string): SonicSnapshot | null {
  if (!/^\d{5}$/.test(zip)) return null;
  if (cache.has(zip)) {
    const hit = cache.get(zip)!;
    return hit && isFresh(hit) ? hit : null;
  }
  let snap: SonicSnapshot | null = null;
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "sonic", `${zip}.json`), "utf8")) as SonicSnapshot;
    if (raw && raw.chain === "sonic" && Array.isArray(raw.products) && raw.store?.address && raw.zip === zip) snap = raw;
  } catch {
    snap = null;
  }
  cache.set(zip, snap);
  return snap && isFresh(snap) ? snap : null;
}

/** ZIPs with a committed Sonic snapshot file (freshness applied at load time). */
export function coveredZips(): string[] {
  try {
    return readdirSync(join(process.cwd(), "data", "sonic"))
      .filter((f) => /^\d{5}\.json$/.test(f))
      .map((f) => f.slice(0, 5))
      .sort();
  } catch {
    return [];
  }
}

export function normalizeItems(snap: SonicSnapshot): NormalizedItem[] {
  const seen = new Set<string>();
  return snap.products.flatMap((p) => {
    if (p.unavailable) return []; // the site itself flags these as not orderable
    if (p.priceCents === null || !Number.isFinite(p.priceCents) || p.priceCents <= 0) return []; // unknown stays unknown
    const key = p.name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (seen.has(key)) return []; // same item listed under a second category (e.g. limited-time + burgers)
    seen.add(key);
    return [{
      restaurantSlug: SONIC_SLUG,
      productId: slugOf(p.href),
      name: p.name,
      description: null,
      category: categoryOf(p),
      calories: p.cal !== null && Number.isFinite(p.cal) ? p.cal : null,
      proteinG: null, // not published on the cards - unknown stays unknown
      imageUrl: null,
      nutritionSourceUrl: `https://www.sonicdrivein.com${p.href}`,
      nutritionConfidence: "high" as const,
      price: p.priceCents / 100,
      pricingType: "exact_store" as const,
      priceSourceUrl: MENU_URL,
      storeId: snap.store.id ?? snap.store.address,
      zip: snap.zip,
      fetchedAt: snap.fetchedAt,
    }];
  });
}

export function itemRows(snap: SonicSnapshot): RankableRow[] {
  return normalizeItems(snap).map((i) => ({
    restaurantSlug: i.restaurantSlug,
    restaurantName: SONIC_NAME,
    productId: i.productId,
    name: i.name,
    category: i.category,
    price: i.price,
    pricingType: i.pricingType,
    calories: i.calories,
    caloriesMin: null,
    caloriesMax: null,
    proteinG: i.proteinG,
    imageUrl: null,
    priceSourceUrl: i.priceSourceUrl,
    nutritionSourceUrl: i.nutritionSourceUrl,
    fetchedAt: i.fetchedAt,
  }));
}

/** No explicit promo feed captured; dual-price card items are already reflected in their exact price. Never invented. */
export function dealRows(_snap: SonicSnapshot): DealRow[] {
  return [];
}
