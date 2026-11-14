import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { openDb } from "../src/modules/db/client";
import { persistRun, recordRefreshRun } from "../src/modules/ingestion/persist";
import { TacoBellAdapter } from "../src/modules/adapters/tacobell";
import { validateRun } from "../src/modules/ingestion/validate";
import { entrees, rankByCalPerDollar } from "../src/modules/scoring/rank";

const fixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "tacobell-036133-menu.json"), "utf8"),
);
const ctx = {
  storeId: "036133",
  zip: "33613",
  fetchedAt: new Date("2026-11-12T00:00:00Z"),
  sourceUrl: "https://www.tacobell.com/tacobellwebservices/v4/tacobell/products/menu/036133",
};

describe("PGlite persistence", () => {
  it("persists validated rows and serves rankable entree queries", async () => {
    const { db, client } = await openDb("memory://");
    const startedAt = new Date();
    const v = validateRun(TacoBellAdapter.normalizeItems(fixture, ctx));
    const result = await persistRun(db, {
      restaurantSlug: "taco-bell", storeId: "036133", zip: "33613",
      address: "2031 E Bearss Ave, Tampa, FL 33613", items: v.accepted,
    });
    await recordRefreshRun(db, {
      adapter: "taco-bell", kind: "menu",
      status: v.anomalies.length ? "quarantined" : "success",
      startedAt, finishedAt: new Date(), itemsUpdated: result.menuItemsUpserted, anomalies: v.anomalies,
    });

    expect(result.menuItemsUpserted).toBe(89);
    expect(result.nutritionRows).toBe(89);
    expect(result.priceRows).toBe(89);

    // latest price + nutrition per item, read back through SQL
    const rows = await db.execute(sql`
      SELECT m.name, m.category,
             p.price::float AS price, p.pricing_type,
             n.calories::float AS calories, n.protein_g::float AS protein_g
      FROM menu_items m
      JOIN LATERAL (SELECT * FROM price_records p WHERE p.menu_item_id = m.id ORDER BY p.fetched_at DESC LIMIT 1) p ON true
      JOIN LATERAL (SELECT * FROM nutrition_records n WHERE n.menu_item_id = m.id ORDER BY n.retrieved_at DESC LIMIT 1) n ON true
    `);
    const items = rows.rows as { name: string; category: string; price: number; pricing_type: string; calories: number; protein_g: number | null }[];
    expect(items).toHaveLength(89);
    for (const r of items) expect(r.pricing_type).toBe("exact_store");

    const ranked = rankByCalPerDollar(entrees(items.map((r, i) => ({
      name: r.name, productId: String(i), calories: r.calories, price: r.price, category: r.category,
    }))));
    expect(ranked.length).toBeGreaterThan(10);
    expect(ranked[0]!.calories! / ranked[0]!.price).toBeGreaterThan(0);
    // no sauce packet on top anymore
    expect(/sauce|packet/i.test(ranked[0]!.name)).toBe(false);

    // refresh run recorded
    const runs = await db.execute(sql`SELECT adapter, status, items_updated FROM data_refresh_runs`);
    expect(runs.rows).toHaveLength(1);
    expect((runs.rows[0] as any).status).toBe("success");

    await client.close();
  }, 30000);
});
