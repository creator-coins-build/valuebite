import { eq, and } from "drizzle-orm";
import type { Db } from "../db/client";
import { restaurants, restaurantLocations, menuItems, nutritionRecords, priceRecords, dataRefreshRuns, deals } from "../db/schema";
import type { NormalizedItem } from "../adapters/types";

/**
 * Persist a validated adapter run.
 * Only rows that passed validateRun() reach this function. Everything written
 * here carries its source URL, pricing type and confidence, so nothing in the
 * database is ever mistaken for better data than it is (spec: honest labels).
 */
export interface PersistResult {
  menuItemsUpserted: number;
  nutritionRows: number;
  priceRows: number;
}

const RESTAURANT_NAMES: Record<string, string> = {
  "taco-bell": "Taco Bell",
  "chick-fil-a": "Chick-fil-A",
  "dominos": "Domino's",
};

export async function ensureRestaurant(db: Db, slug: string): Promise<string> {
  const existing = await db.select().from(restaurants).where(eq(restaurants.slug, slug)).limit(1);
  if (existing[0]) return existing[0].id;
  const [r] = await db
    .insert(restaurants)
    .values({ slug, name: RESTAURANT_NAMES[slug] ?? slug })
    .returning();
  return r!.id;
}

export async function ensureLocation(
  db: Db,
  input: { restaurantId: string; storeId: string; zip: string; address?: string | null },
): Promise<string> {
  const existing = await db
    .select()
    .from(restaurantLocations)
    .where(and(eq(restaurantLocations.restaurantId, input.restaurantId), eq(restaurantLocations.storeId, input.storeId)))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const [l] = await db
    .insert(restaurantLocations)
    .values({ restaurantId: input.restaurantId, storeId: input.storeId, zip: input.zip, address: input.address ?? null })
    .returning();
  return l!.id;
}

export async function persistRun(
  db: Db,
  run: { restaurantSlug: string; storeId: string; zip: string; address?: string | null; items: NormalizedItem[] },
): Promise<PersistResult> {
  const restaurantId = await ensureRestaurant(db, run.restaurantSlug);
  const locationId = await ensureLocation(db, {
    restaurantId, storeId: run.storeId, zip: run.zip, address: run.address ?? null,
  });

  let nutritionRows = 0;
  let priceRows = 0;
  for (const item of run.items) {
    // upsert menu item on (restaurant, product id)
    const existing = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.restaurantId, restaurantId), eq(menuItems.restaurantProductId, item.productId)))
      .limit(1);
    let menuItemId: string;
    if (existing[0]) {
      await db
        .update(menuItems)
        .set({ name: item.name, description: item.description ?? null, category: item.category, lastVerified: new Date(item.fetchedAt) })
        .where(eq(menuItems.id, existing[0].id));
      menuItemId = existing[0].id;
    } else {
      const [m] = await db
        .insert(menuItems)
        .values({
          restaurantId, restaurantProductId: item.productId, name: item.name,
          description: item.description ?? null, category: item.category, lastVerified: new Date(item.fetchedAt),
        })
        .returning();
      menuItemId = m!.id;
    }

    // nutrition: append a fresh snapshot per fetch (history is valuable, dupes are cheap to collapse at read time)
    const hasRange = typeof item.caloriesMin === "number" && typeof item.caloriesMax === "number";
    if (item.calories !== null || item.proteinG !== null || hasRange) {
      await db.insert(nutritionRecords).values({
        menuItemId,
        calories: item.calories === null ? null : String(item.calories),
        caloriesMin: hasRange ? String(item.caloriesMin) : null,
        caloriesMax: hasRange ? String(item.caloriesMax) : null,
        proteinG: item.proteinG === null ? null : String(item.proteinG),
        sourceUrl: item.nutritionSourceUrl,
        retrievedAt: new Date(item.fetchedAt),
        confidence: item.nutritionConfidence,
      });
      nutritionRows++;
    }

    await db.insert(priceRecords).values({
      menuItemId, locationId, zip: item.zip,
      price: String(item.price),
      pricingType: item.pricingType,
      sourceUrl: item.priceSourceUrl,
      fetchedAt: new Date(item.fetchedAt),
      confidence: item.pricingType === "exact_store" ? "high" : item.pricingType === "zip_local" ? "medium" : "low",
    });
    priceRows++;
  }

  return { menuItemsUpserted: run.items.length, nutritionRows, priceRows };
}

/** Persist official coupons as deals. Promo codes carry source URL + lastVerified; UI labels them "listed by official source, checked <time>". */
export async function persistDeals(
  db: Db,
  run: { restaurantSlug: string; coupons: import("../adapters/dominos").NormalizedCoupon[] },
): Promise<number> {
  const restaurantId = await ensureRestaurant(db, run.restaurantSlug);
  const existing = await db.select().from(deals).where(eq(deals.restaurantId, restaurantId));
  const byCode = new Map(existing.map((d) => [d.promoCode, d]));
  const seen = new Set<string>();
  let n = 0;
  for (const c of run.coupons) {
    seen.add(c.code);
    const cur = byCode.get(c.code);
    if (cur) {
      // refresh the evidence on the existing row
      await db.update(deals).set({
        title: c.name,
        price: c.price === null ? null : String(c.price),
        startsAt: c.effectiveOn ? new Date(c.effectiveOn) : null,
        expiresAt: c.expiresOn ? new Date(c.expiresOn) : null,
        sourceUrl: c.sourceUrl,
        lastVerified: new Date(c.lastChecked),
        active: true,
      }).where(eq(deals.id, cur.id));
    } else {
      await db.insert(deals).values({
        restaurantId,
        title: c.name,
        description: null,
        price: c.price === null ? null : String(c.price),
        startsAt: c.effectiveOn ? new Date(c.effectiveOn) : null,
        expiresAt: c.expiresOn ? new Date(c.expiresOn) : null,
        promoCode: c.code,
        pickupOnly: c.serviceMethods.length > 0 && c.serviceMethods.every((m) => m === "Carryout" || m === "Carside"),
        deliveryOnly: c.serviceMethods.length > 0 && c.serviceMethods.every((m) => m === "Delivery"),
        sourceUrl: c.sourceUrl,
        lastVerified: new Date(c.lastChecked),
      });
    }
    n++;
  }
  // deals no longer listed by the official source are retired, never kept active
  for (const d of existing) {
    if (d.promoCode && !seen.has(d.promoCode) && d.active) {
      await db.update(deals).set({ active: false }).where(eq(deals.id, d.id));
    }
  }
  return n;
}

export async function recordRefreshRun(
  db: Db,
  run: { adapter: string; kind: string; status: "success" | "failed" | "quarantined"; startedAt: Date; finishedAt: Date; itemsUpdated: number; anomalies?: unknown; error?: string },
): Promise<void> {
  await db.insert(dataRefreshRuns).values({
    adapter: run.adapter, kind: run.kind, status: run.status,
    startedAt: run.startedAt, finishedAt: run.finishedAt, itemsUpdated: run.itemsUpdated,
    anomalies: run.anomalies === undefined ? null : JSON.parse(JSON.stringify(run.anomalies)),
    error: run.error ?? null,
  });
}
