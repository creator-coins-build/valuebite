/**
 * Seed the file-backed dev DB (./data/pgdb) from the three chains' captured
 * real data for ZIP 33613. Deterministic: uses tests/fixtures captures.
 * Re-run after `rm -rf data/pgdb` for a fresh database.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { openDb } from "../src/modules/db/client";
import { persistRun, persistDeals, persistExclusiveDeals, recordRefreshRun } from "../src/modules/ingestion/persist";
import { validateRun } from "../src/modules/ingestion/validate";
import { TacoBellAdapter, exclusiveDeals } from "../src/modules/adapters/tacobell";
import { DominosAdapter, normalizeCoupons } from "../src/modules/adapters/dominos";
import { parseNutritionHtml } from "../src/modules/adapters/chickfila";
import { toNormalizedItems } from "../src/modules/adapters/chickfila-prices";
import { toNormalizedItems as bkToNormalizedItems } from "../src/modules/adapters/bk-prices";
import { toNormalizedItems as cpToNormalizedItems } from "../src/modules/adapters/chipotle-prices";

const ROOT = new URL("..", import.meta.url).pathname;
const FIXTURES = join(ROOT, "tests", "fixtures");
const fx = (n: string) => JSON.parse(readFileSync(join(FIXTURES, n), "utf8"));
const NOW = new Date();

async function main() {
  const { db, client } = await openDb("./data/pgdb");
  const startedAt = new Date(NOW.getTime() - 60_000);

  // Taco Bell - store 036133, 2031 E Bearss Ave
  const tbCtx = { storeId: "036133", zip: "33613", fetchedAt: NOW, sourceUrl: "https://www.tacobell.com/tacobellwebservices/v4/tacobell/products/menu/036133" };
  const tbRaw = fx("tacobell-036133-menu.json");
  const tbV = validateRun(TacoBellAdapter.normalizeItems(tbRaw, tbCtx));
  const tbR = await persistRun(db, { restaurantSlug: "taco-bell", storeId: "036133", zip: "33613", address: "2031 E Bearss Ave, Tampa, FL 33613", items: tbV.accepted });
  const tbX = await persistExclusiveDeals(db, { restaurantSlug: "taco-bell", exclusives: exclusiveDeals(tbRaw), sourceUrl: tbCtx.sourceUrl, lastChecked: NOW });
  await recordRefreshRun(db, { adapter: "taco-bell", kind: "menu", status: tbV.anomalies.length ? "quarantined" : "success", startedAt, finishedAt: NOW, itemsUpdated: tbR.menuItemsUpserted, anomalies: tbV.anomalies });
  console.log(`taco-bell: ${tbR.menuItemsUpserted} items, ${tbX} exclusive deals`);

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

  // Burger King - official nutrition PDF + Level 4 typical prices
  const bkNutrition = JSON.parse(readFileSync(join(ROOT, "data", "bk-nutrition.json"), "utf8"));
  const bkEst = JSON.parse(readFileSync(join(ROOT, "data", "burger-king-price-estimates.json"), "utf8")).estimates;
  const { items: bkItems, unmatchedPriced: bkUnmatched } = bkToNormalizedItems(bkNutrition, bkEst, { zip: "33613", fetchedAt: NOW });
  const bkV = validateRun(bkItems);
  const bkR = await persistRun(db, { restaurantSlug: "burger-king", storeId: "", zip: "33613", items: bkV.accepted });
  await recordRefreshRun(db, { adapter: "burger-king", kind: "menu", status: bkV.anomalies.length ? "quarantined" : "success", startedAt, finishedAt: NOW, itemsUpdated: bkR.menuItemsUpserted, anomalies: bkV.anomalies });
  console.log(`burger-king: ${bkR.menuItemsUpserted} items (${bkUnmatched.length} DTI items skipped - no official nutrition)`);

  // Chipotle - official per-ingredient nutrition composed into entrees + Level 4 typical prices
  const cpNutrition = JSON.parse(readFileSync(join(ROOT, "data", "chipotle-nutrition.json"), "utf8"));
  const cpEst = JSON.parse(readFileSync(join(ROOT, "data", "chipotle-price-estimates.json"), "utf8")).estimates;
  const { items: cpItems, unmatchedPriced: cpUnmatched } = cpToNormalizedItems(cpNutrition, cpEst, { zip: "33613", fetchedAt: NOW });
  const cpV = validateRun(cpItems);
  const cpR = await persistRun(db, { restaurantSlug: "chipotle", storeId: "", zip: "33613", items: cpV.accepted });
  await recordRefreshRun(db, { adapter: "chipotle", kind: "menu", status: cpV.anomalies.length ? "quarantined" : "success", startedAt, finishedAt: NOW, itemsUpdated: cpR.menuItemsUpserted, anomalies: cpV.anomalies });
  console.log(`chipotle: ${cpR.menuItemsUpserted} items (${cpUnmatched.length} DTI items skipped - no official nutrition)`);

  await client.close();
  console.log("seeded ./data/pgdb");
}

main();
