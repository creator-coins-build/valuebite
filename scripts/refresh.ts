/**
 * Phase 8: live data refresh for a ZIP.
 *
 * Fetches current data from every adapter's official source, validates the
 * run (per-item drops + whole-run anomaly quarantine), persists accepted
 * rows, and records a data_refresh_runs entry per adapter. A quarantined run
 * is recorded but its items are NOT persisted (spec s22).
 *
 * Usage: npx tsx scripts/refresh.ts [zip]
 */
import { openDb } from "../src/modules/db/client";
import { persistRun, persistDeals, persistExclusiveDeals, recordRefreshRun } from "../src/modules/ingestion/persist";
import { validateRun } from "../src/modules/ingestion/validate";
import { TacoBellAdapter, exclusiveDeals } from "../src/modules/adapters/tacobell";
import { DominosAdapter, normalizeCoupons } from "../src/modules/adapters/dominos";
import { resolveStores } from "../src/modules/location/resolve";

const ZIP = process.argv[2] ?? "33613";
const DB = process.env.VALUEBITE_DB ?? "./data/pgdb";

async function main() {
  const { db, client } = await openDb(DB);
  const startedAt = new Date();
  const stores = await resolveStores(ZIP);
  const tbStore = stores["taco-bell"][0];
  const dmStore = stores.dominos[0];
  console.log(`ZIP ${ZIP}: ${stores["taco-bell"].length} taco bell stores, ${stores.dominos.length} dominos stores`);

  if (tbStore) {
    try {
      const ctx = { storeId: tbStore.storeId, zip: ZIP, fetchedAt: new Date(), sourceUrl: `https://www.tacobell.com/tacobellwebservices/v4/tacobell/products/menu/${tbStore.storeId}` };
      const raw = await TacoBellAdapter.fetchMenu({ storeId: tbStore.storeId });
      const v = validateRun(TacoBellAdapter.normalizeItems(raw, ctx));
      let updated = 0, xDeals = 0;
      if (!v.quarantine) {
        updated = (await persistRun(db, { restaurantSlug: "taco-bell", storeId: tbStore.storeId, zip: ZIP, address: tbStore.address, items: v.accepted })).menuItemsUpserted;
        xDeals = await persistExclusiveDeals(db, { restaurantSlug: "taco-bell", exclusives: exclusiveDeals(raw), sourceUrl: ctx.sourceUrl, lastChecked: ctx.fetchedAt });
      }
      await recordRefreshRun(db, { adapter: "taco-bell", kind: "menu", status: v.quarantine ? "quarantined" : "success", startedAt, finishedAt: new Date(), itemsUpdated: updated, anomalies: v.anomalies });
      console.log(`taco-bell: ${updated} items, ${xDeals} exclusive deals${v.quarantine ? " (QUARANTINED: " + v.anomalies.join(",") + ")" : ""}`);
    } catch (e) {
      await recordRefreshRun(db, { adapter: "taco-bell", kind: "menu", status: "failed", startedAt, finishedAt: new Date(), itemsUpdated: 0, error: String(e) });
      console.log(`taco-bell: FAILED ${e}`);
    }
  }

  if (dmStore) {
    try {
      const ctx = { storeId: dmStore.storeId, zip: ZIP, fetchedAt: new Date(), sourceUrl: `https://order.dominos.com/power/store/${dmStore.storeId}/menu?lang=en&structured=true` };
      const raw = await DominosAdapter.fetchMenu({ storeId: dmStore.storeId });
      const v = validateRun(DominosAdapter.normalizeItems(raw, ctx), undefined, { requireCalories: false });
      let updated = 0, dealsN = 0;
      if (!v.quarantine) {
        updated = (await persistRun(db, { restaurantSlug: "dominos", storeId: dmStore.storeId, zip: ZIP, address: dmStore.address, items: v.accepted })).menuItemsUpserted;
        dealsN = await persistDeals(db, { restaurantSlug: "dominos", coupons: normalizeCoupons(raw, ctx) });
      }
      await recordRefreshRun(db, { adapter: "dominos", kind: "menu", status: v.quarantine ? "quarantined" : "success", startedAt, finishedAt: new Date(), itemsUpdated: updated, anomalies: v.anomalies });
      console.log(`dominos: ${updated} items, ${dealsN} deals${v.quarantine ? " (QUARANTINED)" : ""}`);
    } catch (e) {
      await recordRefreshRun(db, { adapter: "dominos", kind: "menu", status: "failed", startedAt, finishedAt: new Date(), itemsUpdated: 0, error: String(e) });
      console.log(`dominos: FAILED ${e}`);
    }
  }

  // Chick-fil-A: nutrition page is chain-wide; refresh is a fetch + re-pair with the
  // harvested estimate file (scripts/harvest-cfa-prices.ts, run separately on a slower cadence).
  // Skipped here: no per-ZIP fetch exists.

  // staleness: report any restaurant whose newest price record is older than 48h
  const stale = await db.execute(
    // newest fetch per restaurant
    (await import("drizzle-orm")).sql`
      SELECT r.slug, max(p.fetched_at) AS newest
      FROM price_records p JOIN menu_items m ON m.id = p.menu_item_id JOIN restaurants r ON r.id = m.restaurant_id
      GROUP BY 1
    `,
  );
  for (const row of stale.rows as any[]) {
    const ageH = (Date.now() - new Date(row.newest).getTime()) / 3.6e6;
    if (ageH > 48) console.log(`STALE: ${row.slug} newest price is ${ageH.toFixed(0)}h old`);
  }

  await client.close();
}

main();
