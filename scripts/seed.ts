/**
 * Seed the file-backed dev DB (./data/pgdb) from the three chains' captured
 * real data for ZIP 33613. Deterministic: uses tests/fixtures captures.
 * Re-run after `rm -rf data/pgdb` for a fresh database.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../src/modules/db/client";
import { persistRun, persistDeals, recordRefreshRun } from "../src/modules/ingestion/persist";
import { validateRun } from "../src/modules/ingestion/validate";
import { TacoBellAdapter } from "../src/modules/adapters/tacobell";
import { DominosAdapter, normalizeCoupons } from "../src/modules/adapters/dominos";
import { parseNutritionHtml } from "../src/modules/adapters/chickfila";
import { toNormalizedItems } from "../src/modules/adapters/chickfila-prices";

const ROOT = new URL("..", import.meta.url).pathname;
const FIXTURES = join(ROOT, "tests", "fixtures");
const fx = (n: string) => JSON.parse(readFileSync(join(FIXTURES, n), "utf8"));
const NOW = new Date();

async function main() {
  const { db, client } = await openDb("./data/pgdb");
  const startedAt = new Date(NOW.getTime() - 60_000);

  // Taco Bell - store 036133, 2031 E Bearss Ave
  const tbCtx = { storeId: "036133", zip: "33613", fetchedAt: NOW, sourceUrl: "https://www.tacobell.com/tacobellwebservices/v4/tacobell/products/menu/036133" };
  const tbV = validateRun(TacoBellAdapter.normalizeItems(fx("tacobell-036133-menu.json"), tbCtx));
  const tbR = await persistRun(db, { restaurantSlug: "taco-bell", storeId: "036133", zip: "33613", address: "2031 E Bearss Ave, Tampa, FL 33613", items: tbV.accepted });
  await recordRefreshRun(db, { adapter: "taco-bell", kind: "menu", status: tbV.anomalies.length ? "quarantined" : "success", startedAt, finishedAt: NOW, itemsUpdated: tbR.menuItemsUpserted, anomalies: tbV.anomalies });
  console.log(`taco-bell: ${tbR.menuItemsUpserted} items`);

  // Domino's - store 3813, 14955 N Florida Ave + coupons
  const dmCtx = { storeId: "3813", zip: "33613", fetchedAt: NOW, sourceUrl: "https://order.dominos.com/power/store/3813/menu?lang=en&structured=true" };
  const dmRaw = fx("dominos-3813-menu.json");
  const dmV = validateRun(DominosAdapter.normalizeItems(dmRaw, dmCtx), undefined, { requireCalories: false });
  const dmR = await persistRun(db, { restaurantSlug: "dominos", storeId: "3813", zip: "33613", address: "14955 N Florida Ave, Tampa, FL 33613", items: dmV.accepted });
  const deals = await persistDeals(db, { restaurantSlug: "dominos", coupons: normalizeCoupons(dmRaw, dmCtx) });
  await recordRefreshRun(db, { adapter: "dominos", kind: "menu", status: "success", startedAt, finishedAt: NOW, itemsUpdated: dmR.menuItemsUpserted, anomalies: [] });
  console.log(`dominos: ${dmR.menuItemsUpserted} items, ${deals} deals`);

  // Chick-fil-A - official nutrition + Level 4 typical prices
  const cfaHtml = readFileSync(join(FIXTURES, "cfa-nutrition-full.html"), "utf8");
  const estimates = JSON.parse(readFileSync(join(ROOT, "data", "cfa-price-estimates.json"), "utf8")).estimates;
  const { items: cfaItems } = toNormalizedItems(parseNutritionHtml(cfaHtml), estimates, { zip: "33613", fetchedAt: NOW });
  const cfaV = validateRun(cfaItems);
  const cfaR = await persistRun(db, { restaurantSlug: "chick-fil-a", storeId: "", zip: "33613", items: cfaV.accepted });
  await recordRefreshRun(db, { adapter: "chick-fil-a", kind: "menu", status: cfaV.anomalies.length ? "quarantined" : "success", startedAt, finishedAt: NOW, itemsUpdated: cfaR.menuItemsUpserted, anomalies: cfaV.anomalies });
  console.log(`chick-fil-a: ${cfaR.menuItemsUpserted} items`);

  await client.close();
  console.log("seeded ./data/pgdb");
}

main();
