import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseNutritionHtml } from "../src/modules/adapters/chickfila";
import { slugify, matchEstimate, toNormalizedItems, type CfaPriceEstimate } from "../src/modules/adapters/chickfila-prices";

const estimates = (JSON.parse(readFileSync(join(__dirname, "..", "data", "cfa-price-estimates.json"), "utf8")) as { estimates: CfaPriceEstimate[] }).estimates;

describe("cfa price estimates", () => {
  it("harvested data has a typical price, range and checked date on every row", () => {
    expect(estimates.length).toBeGreaterThanOrEqual(50);
    for (const e of estimates) {
      expect(e.typical).toBeGreaterThan(0);
      expect(e.low).toBeLessThanOrEqual(e.typical);
      expect(e.high).toBeGreaterThanOrEqual(e.typical);
      expect(e.checkedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.sourceUrl).toContain("drivethruindex.com/items/chick-fil-a/");
    }
  });

  it("slugify matches DTI slugs to official item titles", () => {
    expect(slugify("Chick-fil-A® Chicken Sandwich")).toBe("chick-fil-a-chicken-sandwich");
    expect(slugify("10 ct Chick-fil-A Chick-n-Minis®")).toBe("10-ct-chick-fil-a-chick-n-minis");
    const est = estimates.find((e) => e.slug === "chick-fil-a-chicken-sandwich")!;
    expect(matchEstimate({ id: "1", title: "Chick-fil-A Chicken Sandwich", link: null, calories: 420, proteinG: 28, fields: {} }, estimates)).toEqual(est);
  });

  it("items without an honest price produce no row", () => {
    const nutrition = [
      { id: "x1", title: "Totally Made Up Item", link: null, calories: 500, proteinG: 30, fields: {} },
      { id: "x2", title: "Chick-fil-A Chicken Sandwich", link: null, calories: 420, proteinG: 28, fields: {} },
    ];
    const { items } = toNormalizedItems(nutrition, estimates, { zip: "33613", fetchedAt: new Date() });
    expect(items).toHaveLength(1);
    expect(items[0]!.productId).toBe("x2");
    expect(items[0]!.pricingType).toBe("national_estimate");
    expect(items[0]!.price).toBeGreaterThan(0);
  });

  it("real pairing: most DTI estimates match an official nutrition item", () => {
    const full = readFileSync(join(__dirname, "fixtures", "cfa-nutrition-full.html"), "utf8");
    const items = parseNutritionHtml(full);
    const { items: rows } = toNormalizedItems(items, estimates, { zip: "33613", fetchedAt: new Date() });
    // 52 of 60 DTI estimates matched on the 2026-11-13 harvest; require most, not all
    expect(rows.length).toBeGreaterThanOrEqual(45);
    for (const r of rows) {
      expect(r.pricingType).toBe("national_estimate");
      expect(r.proteinG).not.toBeNull();
      expect(r.priceSourceUrl).toContain("drivethruindex.com");
    }
  });
});
