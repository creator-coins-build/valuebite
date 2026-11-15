/**
 * Export the seeded DB to a static JSON snapshot (data/snapshot.json).
 * The hosted server reads this instead of opening PGlite per request:
 * Render's free tier (512Mi) OOM-kills Next.js + PGlite together.
 */
import { writeFileSync } from "node:fs";
import { openDb } from "../src/modules/db/client";
import { rankableRows, activeDeals } from "../src/modules/db/queries";

async function main() {
  const { db, client } = await openDb("./data/pgdb");
  const rows = await rankableRows(db, "33613");
  const deals = await activeDeals(db);
  writeFileSync("data/snapshot.json", JSON.stringify({ zip: "33613", generatedAt: new Date().toISOString(), rows, deals }));
  console.log(`snapshot: ${rows.length} rows, ${deals.length} deals`);
  await client.close();
}

main();
