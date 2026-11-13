import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { openDb } from "../src/modules/db/client";
import { persistRun, persistDeals } from "../src/modules/ingestion/persist";
import { DominosAdapter, normalizeCoupons } from "../src/modules/adapters/dominos";
import { parseNutritionHtml } from "../src/modules/adapters/chickfila";
import { toNormalizedItems, type CfaPriceEstimate } from "../src/modules/adapters/chickfila-prices";
import { validateRun } from "../src/modules/ingestion/validate";

const dmFixture = JSON.parse(readFileSync(join(__dirname, "fixtures", "dominos-3813-menu.json"), "utf8"));
const cfaHtml = readFileSync(join(__dirname, "fixtures", "cfa-nutrition-full.html"), "utf8");
const estimates = (JSON.parse(readFileSync(join(__dirname, "..", "data", "cfa-price-estimates.json"), "utf8")) as { estimates: CfaPriceEstimate[] }).estimates;

describe("persist all three chains", () => {
  it("persists CFA rows, Domino's rows and Domino's official coupons", async () => {
    const { db, client } = await openDb("memory://");

    // Chick-fil-A: official nutrition + Level 4 typical prices
    const nutrition = parseNutritionHtml(cfaHtml);
    const { items: cfaItems } = toNormalizedItems(nutrition, estimates, { zip: "33613", fetchedAt: new Date("2026-11-13T15:00:00Z") });
    const cfaV = validateRun(cfaItems);
    const cfaResult = await persistRun(db, { restaurantSlug: "chick-fil-a", storeId: "", zip: "33613", items: cfaV.accepted });
    expect(cfaResult.menuItemsUpserted).toBeGreaterThanOrEqual(45);

    // Domino's: exact prices, unknown nutrition
    const dmCtx = { storeId: "3813", zip: "33613", fetchedAt: new Date("2026-11-13T15:00:00Z"), sourceUrl: "https://order.dominos.com/power/store/3813/menu?lang=en&structured=true" };
    const dmItems = DominosAdapter.normalizeItems(dmFixture, dmCtx);
    const dmV = validateRun(dmItems, undefined, { requireCalories: false });
    const dmResult = await persistRun(db, { restaurantSlug: "dominos", storeId: "3813", zip: "33613", address: "14955 N Florida Ave, Tampa, FL 33613", items: dmV.accepted });
    expect(dmResult.menuItemsUpserted).toBe(221);

    // Domino's coupons as deals
    const dealCount = await persistDeals(db, { restaurantSlug: "dominos", coupons: normalizeCoupons(dmFixture, dmCtx) });
    expect(dealCount).toBe(26);

    // CFA prices are honestly labeled in the DB
    const priceTypes = await db.execute(sql`SELECT pricing_type, count(*)::int AS n FROM price_records GROUP BY 1 ORDER BY 1`);
    const byType = Object.fromEntries((priceTypes.rows as any[]).map((r) => [r.pricing_type, r.n]));
    expect(byType["national_estimate"]).toBe(cfaV.accepted.length);
    expect(byType["exact_store"]).toBe(221);

    // deals carry promo code + freshness
    const dealRows = await db.execute(sql`SELECT promo_code, expires_at, last_verified, price FROM deals WHERE promo_code IS NOT NULL`);
    expect(dealRows.rows).toHaveLength(26);
    const paze = (dealRows.rows as any[]).find((r) => r.promo_code === "PAZE35OFF");
    expect(paze).toBeDefined();
    expect(new Date(paze.expires_at).toISOString().slice(0, 10)).toBe("2026-11-30");
    // %-off coupons have null price, priced bundles keep theirs
    expect((dealRows.rows as any[]).some((r) => r.price === null)).toBe(true);
    expect((dealRows.rows as any[]).some((r) => r.price !== null)).toBe(true);

    await client.close();
  }, 60000);
});
