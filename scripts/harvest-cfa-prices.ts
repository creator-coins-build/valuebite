/**
 * One-off harvest: Drive Thru Index per-item price stats for Chick-fil-A.
 *
 * Source: drivethruindex.com - third-party tracker that reads official ordering
 * sites daily across ~3,000 US stores and publishes typical price + range with
 * a checked date in each page's JSON-LD Dataset. This is Level 4
 * (national_estimate) data under the pricing fallback ladder: honest "Typical
 * price - may vary", never presented as exact.
 *
 * Output: data/cfa-price-estimates.json
 */
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "https://drivethruindex.com";
const UA = { "user-agent": "Mozilla/5.0 (compatible; ValueBiteBot/0.1)" };
const DELAY_MS = 1200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface CfaPriceEstimate {
  slug: string;
  itemName: string;
  typical: number;
  low: number;
  high: number;
  storeCount: number;
  checkedDate: string; // ISO date from the page
  sourceUrl: string;
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

function parseItemPage(html: string, url: string): CfaPriceEstimate | null {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  for (const b of blocks) {
    let d: any;
    try {
      d = JSON.parse(b[1]!);
    } catch {
      continue;
    }
    if (d?.["@type"] !== "Dataset") continue;
    const desc: string = d.description ?? "";
    // "A Chick-fil-A Chicken Sandwich costs $4.85 to $7.69 across 3,055 US Chick-fil-A restaurants, typically $5.25. ... Checked 2026-11-13."
    const m = desc.match(/^(?:A |An )?(.+?) costs \$(\d+(?:\.\d+)?) to \$(\d+(?:\.\d+)?) across ([\d,]+) US .+?typically \$(\d+(?:\.\d+)?)/);
    if (!m) continue;
    return {
      slug: url.split("/").pop()!,
      itemName: m[1]!,
      low: Number(m[2]),
      high: Number(m[3]),
      storeCount: Number(m[4]!.replace(/,/g, "")),
      typical: Number(m[5]),
      checkedDate: String(d.dateModified ?? ""),
      sourceUrl: url,
    };
  }
  return null;
}

async function main() {
  const brand = await get(`${BASE}/brands/chick-fil-a`);
  const slugs = [...new Set([...brand.matchAll(/href="\/items\/chick-fil-a\/([^"]+)"/g)].map((m) => m[1]!))];
  console.log(`found ${slugs.length} item pages`);
  const out: CfaPriceEstimate[] = [];
  for (const slug of slugs) {
    const url = `${BASE}/items/chick-fil-a/${slug}`;
    try {
      const est = parseItemPage(await get(url), url);
      if (est) out.push(est);
      else console.warn(`no dataset on ${slug}`);
    } catch (e) {
      console.warn(`failed ${slug}: ${(e as Error).message}`);
    }
    await sleep(DELAY_MS);
  }
  mkdirSync("data", { recursive: true });
  writeFileSync("data/cfa-price-estimates.json", JSON.stringify({ harvestedAt: new Date().toISOString(), estimates: out }, null, 2));
  console.log(`wrote ${out.length} estimates`);
}

main();
