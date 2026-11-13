import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TacoBellAdapter } from "../src/modules/adapters/tacobell";
import { validateRun } from "../src/modules/ingestion/validate";
import { entrees, isEntree, rankByCalPerDollar, rankCheapest, DEFAULT_ENTREE_RULE } from "../src/modules/scoring/rank";

const fixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "tacobell-036133-menu.json"), "utf8"),
);
const ctx = {
  storeId: "036133",
  zip: "33613",
  fetchedAt: new Date("2026-11-12T00:00:00Z"),
  sourceUrl: "https://www.tacobell.com/tacobellwebservices/v4/tacobell/products/menu/036133",
};
const accepted = validateRun(TacoBellAdapter.normalizeItems(fixture, ctx)).accepted;

describe("entree filter", () => {
  it("excludes sauces, drinks, sides and sweets", () => {
    const ents = entrees(accepted);
    expect(ents.length).toBeGreaterThan(0);
    expect(ents.length).toBeLessThan(accepted.length);
    for (const e of ents) {
      expect(DEFAULT_ENTREE_RULE.excludedCategories.has(e.category)).toBe(false);
      expect(e.calories).not.toBeNull();
      expect(e.calories!).toBeGreaterThanOrEqual(DEFAULT_ENTREE_RULE.minCalories);
    }
  });

  it("no sauce packet ranks above an entree in cal/$", () => {
    const ranked = rankByCalPerDollar(entrees(accepted));
    const top = ranked.slice(0, 10);
    for (const t of top) expect(isEntree(t)).toBe(true);
    // the raw list is known to be sauce-dominated; the filtered one must not be
    expect(top.some((t) => /sauce|packet/i.test(t.name))).toBe(false);
  });

  it("drops items under the calorie bar even in allowed categories", () => {
    expect(isEntree({ calories: 50, category: "tacos" })).toBe(false);
    expect(isEntree({ calories: 500, category: "sauces" })).toBe(false);
    expect(isEntree({ calories: 500, category: "tacos" })).toBe(true);
    expect(isEntree({ calories: null, category: "tacos" })).toBe(false);
  });

  it("cheapest ranking on entrees returns real food", () => {
    const ranked = rankCheapest(entrees(accepted));
    expect(ranked[0]!.price).toBeGreaterThan(0);
    expect(isEntree(ranked[0]!)).toBe(true);
  });
});
