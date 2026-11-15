import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { toNormalizedItems as bkToNormalizedItems } from "../src/modules/adapters/bk-prices";
import { toNormalizedItems as cpToNormalizedItems } from "../src/modules/adapters/chipotle-prices";

const bkNutrition = JSON.parse(readFileSync("data/bk-nutrition.json", "utf8"));
const bkEst = JSON.parse(readFileSync("data/burger-king-price-estimates.json", "utf8")).estimates;
const cpNutrition = JSON.parse(readFileSync("data/chipotle-nutrition.json", "utf8"));
const cpEst = JSON.parse(readFileSync("data/chipotle-price-estimates.json", "utf8")).estimates;
const ctx = { zip: "33613", fetchedAt: new Date("2026-11-14T00:00:00Z") };

describe("burger-king PDF nutrition + DTI prices", () => {
  const { items, unmatchedPriced } = bkToNormalizedItems(bkNutrition, bkEst, ctx);
  it("maps Whopper to official PDF nutrition", () => {
    const w = items.find((i) => i.productId === "whopper")!;
    expect(w.calories).toBe(670);
    expect(w.proteinG).toBe(31);
    expect(w.pricingType).toBe("national_estimate");
    expect(w.price).toBeGreaterThan(0);
    expect(w.nutritionSourceUrl).toContain("bk-use1-prod.sites.rbictg.com");
  });
  it("skips items with no official nutrition instead of guessing", () => {
    expect(unmatchedPriced).toContain("Burger King Medium Coca-Cola");
    expect(items.find((i) => i.productId === "medium-coca-cola")).toBeUndefined();
  });
});

describe("chipotle composed nutrition + DTI prices", () => {
  const { items, unmatchedPriced } = cpToNormalizedItems(cpNutrition, cpEst, ctx);
  it("composes a Chicken Burrito from official per-ingredient values", () => {
    const b = items.find((i) => i.productId === "chicken-bowl")!;
    // white rice 210 + black beans 130 + fajita 20 + chicken 180 + tomato salsa 25 + cheese 110 + lettuce 5 = 680
    expect(b.calories).toBe(680);
    expect(b.nutritionConfidence).toBe("medium");
    expect(b.description).toContain("Build:");
  });
  it("maps side items directly", () => {
    const g = items.find((i) => i.productId === "side-of-guacamole")!;
    expect(g.calories).toBe(230);
  });
  it("skips items with no official nutrition", () => {
    expect(items.find((i) => i.productId === "mexican-coca-cola")).toBeUndefined();
    expect(unmatchedPriced.length).toBeGreaterThan(0);
  });
});
