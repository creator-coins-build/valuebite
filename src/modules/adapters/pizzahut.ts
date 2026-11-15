import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedItem } from "./types";
import type { RankableRow, DealRow } from "../db/queries";

/**
 * Pizza Hut: official per-store data from the chain's own public ordering
 * site (pizzahut.com). The site is a Next.js app whose storefront calls the
 * Yum! Brands public GraphQL API with an anonymous guest token the site
 * itself mints for every visitor (no account, no sign-in):
 *
 *   POST https://api.prod.ph-us.yumconnect.dev/ph_us/storefront/graphql
 *     GetCategoryByCode(storeNumber, channel:"WEB", categoryCode)  -> items + variants
 *     GetBundlesByCode(storeNumber, channel:"WEB")                 -> meal deals
 *
 * Store selection happens through the site's normal public carryout flow
 * (enter ZIP, pick the store it lists). The API is only reachable from a
 * real browser session, so per-ZIP snapshots are captured through a normal
 * browser session during the refresh and committed under
 * data/pizzahut/<zip>.json. A ZIP without a committed snapshot has no Pizza
 * Hut rows at all - never another store's prices under its name.
 *
 * Nutrition units: each variant carries nutritionInformation entries like
 * calories:320 / servings:8 / unit:slice) are BASE-ONLY; the site displays
 * a composite including default modifiers. PH calories are currently
 * suppressed (unknown) pending composition verification - see
 * docs/research/ph-nutrition-units-2026-11-15.md.
 * Protein is not published per item here, so PH rows stay out of the
 * protein-based Value Score ranking (unknown stays unknown).
 */

export const PIZZA_HUT_SLUG = "pizzahut";
export const PIZZA_HUT_NAME = "Pizza Hut";
const MENU_URL = "https://www.pizzahut.com/menu/pizza";

export interface PHProduct {
  name: string;
  base: string;
  sku: string;
  cat: string;
  priceCents: number | null;
  cal: number | null;
  serv: number | null;
  unit: string | null;
  desc: string;
}

export interface PHDeal {
  title: string;
  code: string;
  desc: string;
  priceCents: number | null;
}

export interface PizzaHutSnapshot {
  fetchedAt: string;
  zip: string;
  storeId: string;
  storeAddress: string;
  source: string;
  products: PHProduct[];
  deals: PHDeal[];
}

/**
 * Whole-item calories. SUPPRESSED (2026-11-15): the feed's variant calories
 * are base-only - the site's own menu displays a composite of base +
 * crust/size + default toppings (e.g. Large Hand-Tossed Pepperoni: feed says
 * 176/slice, the site displays 323 cal/slice; default modifiers carry their
 * own nutritionInformation). Until the composite composition is verified
 * against the site's display, every PH calorie stays unknown (never show a
 * number we cannot stand behind). Restore per-category only with evidence.
 */
export function wholeCalories(p: Pick<PHProduct, "cal" | "serv">): number | null {
  return null;
}

const cache = new Map<string, PizzaHutSnapshot | null>();

export function isFresh(snap: PizzaHutSnapshot, now = Date.now()): boolean {
  const age = now - Date.parse(snap.fetchedAt);
  return age >= 0 && age < 48 * 3600_000;
}

/** Committed snapshot for a ZIP, or null when this ZIP has no Pizza Hut coverage (or it is stale). */
export function loadSnapshot(zip: string): PizzaHutSnapshot | null {
  if (!/^\d{5}$/.test(zip)) return null;
  if (cache.has(zip)) {
    const hit = cache.get(zip)!;
    return hit && isFresh(hit) ? hit : null;
  }
  let snap: PizzaHutSnapshot | null = null;
  try {
    const raw = JSON.parse(readFileSync(join(process.cwd(), "data", "pizzahut", `${zip}.json`), "utf8")) as PizzaHutSnapshot;
    if (raw && Array.isArray(raw.products) && raw.storeAddress && raw.zip === zip) snap = raw;
  } catch {
    snap = null;
  }
  cache.set(zip, snap);
  return snap && isFresh(snap) ? snap : null;
}

/** ZIPs with a committed Pizza Hut snapshot file (freshness applied at load time). */
export function coveredZips(): string[] {
  try {
    return readdirSync(join(process.cwd(), "data", "pizzahut"))
      .filter((f) => /^\d{5}\.json$/.test(f))
      .map((f) => f.slice(0, 5))
      .sort();
  } catch {
    return [];
  }
}

/** Display cleanup for an encoding artifact in the API's variant names ("Medium v Hand-Tossed"). Prices/nutrition untouched. */
export function displayName(name: string): string {
  return name.replace(/\s+v\s+/g, " ").replace(/\s{2,}/g, " ").trim();
}

export function normalizeItems(snap: PizzaHutSnapshot): NormalizedItem[] {
  return snap.products.flatMap((p) => {
    if (!p.priceCents || p.priceCents <= 0) return [];
    return [{
      restaurantSlug: PIZZA_HUT_SLUG,
      productId: p.sku,
      name: displayName(p.name),
      description: p.desc || null,
      category: p.cat,
      calories: wholeCalories(p),
      proteinG: null, // not published - unknown stays unknown
      imageUrl: null, // this API carries no product images
      nutritionSourceUrl: MENU_URL,
      nutritionConfidence: "high" as const,
      price: p.priceCents / 100,
      pricingType: "exact_store" as const,
      priceSourceUrl: MENU_URL,
      storeId: snap.storeId,
      zip: snap.zip,
      fetchedAt: snap.fetchedAt,
    }];
  });
}

export function itemRows(snap: PizzaHutSnapshot): RankableRow[] {
  return normalizeItems(snap).map((i) => ({
    restaurantSlug: i.restaurantSlug,
    restaurantName: PIZZA_HUT_NAME,
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

export function dealRows(snap: PizzaHutSnapshot): DealRow[] {
  return snap.deals.flatMap((d) => {
    if (!d.priceCents || d.priceCents <= 0) return [];
    return [{
      restaurantName: PIZZA_HUT_NAME,
      title: d.title,
      description: d.desc,
      price: d.priceCents / 100,
      // Bundle codes are the site's internal identifiers, not codes a customer types.
      promoCode: null,
      expiresAt: null, // no expiry published; freshness comes from the snapshot's fetchedAt
      lastVerified: snap.fetchedAt,
      sourceUrl: "https://www.pizzahut.com/deals",
      appOnly: false,
      redemption: "online",
    }];
  });
}
