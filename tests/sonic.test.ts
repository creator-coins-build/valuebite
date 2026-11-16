import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadSnapshot, normalizeItems, itemRows, dealRows, coveredZips, categoryOf,
  SONIC_SLUG, type SonicSnapshot,
} from "../src/modules/adapters/sonic";

const snap = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "sonic", "33613.json"), "utf8"),
) as SonicSnapshot;

describe("sonic snapshot adapter", () => {
  it("loads the committed 33613 snapshot and rejects uncovered ZIPs", () => {
    const loaded = loadSnapshot("33613");
    expect(loaded).not.toBeNull();
    expect(loaded!.store.address).toContain("Fowler");
    expect(loaded!.products.length).toBeGreaterThan(150);
    expect(loadSnapshot("99999")).toBeNull();
    expect(loadSnapshot("33613!")).toBeNull();
  });

  it("reports covered ZIPs from committed snapshot files", () => {
    expect(coveredZips()).toContain("33613");
  });

  it("drops items with unknown price and items the site flags unavailable", () => {
    const items = normalizeItems(snap);
    for (const i of items) {
      expect(i.price).toBeGreaterThan(0);
      expect(i.pricingType).toBe("exact_store");
    }
    const unavailable = snap.products.filter((p) => p.unavailable).length;
    const unpriced = snap.products.filter((p) => !p.unavailable && (p.priceCents === null || p.priceCents <= 0)).length;
    expect(items.length).toBeLessThanOrEqual(snap.products.length - unavailable - unpriced); // cross-category duplicates collapse to one row
    expect(unpriced).toBeGreaterThan(0); // 63 items showed no price at capture - unknown stays unknown
    const names = items.map((i) => i.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length); // no duplicate rows for the same item
  });

  it("maps categories so drinks/sweets/sauces never rank as entrees", () => {
    expect(categoryOf({ name: "Ocean Water", cat: "sodas", href: "/menu/categories/sodas/x/ocean-water", priceCents: 1, listPriceCents: null, cal: 1, unavailable: false })).toBe("drinks");
    expect(categoryOf({ name: "Classic Shake", cat: "sweets", href: "/menu/categories/sweets/classic-shakes/x", priceCents: 1, listPriceCents: null, cal: 1, unavailable: false })).toBe("sweets");
    expect(categoryOf({ name: "Ranch", cat: "extra-sauces", href: "/menu/categories/extra-sauces/ranch", priceCents: 1, listPriceCents: null, cal: 1, unavailable: false })).toBe("sauces");
    expect(categoryOf({ name: "$7 Big Deal Meal", cat: "value", href: "/menu/categories/value/bundles/7-big-deal-meal", priceCents: 1, listPriceCents: null, cal: 1, unavailable: false })).toBe("combos");
    expect(categoryOf({ name: "Small BARQ'S Root Beer Float", cat: "value", href: "/menu/categories/value/1-99-menu/small-barq-s-root-beer-float", priceCents: 1, listPriceCents: null, cal: 1, unavailable: false })).toBe("sweets");
    expect(categoryOf({ name: "Jr Bacon Cheeseburger", cat: "value", href: "/menu/categories/value/1-99-menu/jr-bacon-cheeseburger", priceCents: 1, listPriceCents: null, cal: 1, unavailable: false })).toBe("value");
    expect(categoryOf({ name: "Coffee", cat: "breakfast-all-day", href: "/menu/categories/breakfast-all-day/breakfast-drinks/coffee", priceCents: 1, listPriceCents: null, cal: 1, unavailable: false })).toBe("drinks");
  });

  it("keeps card calories as displayed and protein unknown", () => {
    const items = normalizeItems(snap);
    const dealMeal = items.find((i) => i.productId === "7-big-deal-meal");
    expect(dealMeal?.calories).toBe(940);
    expect(dealMeal?.price).toBeCloseTo(7.0);
    for (const i of items) expect(i.proteinG).toBeNull();
  });

  it("emits rows for ranking and never invents deals", () => {
    const rows = itemRows(snap);
    expect(rows.length).toBeGreaterThan(100);
    expect(rows[0]!.restaurantSlug).toBe(SONIC_SLUG);
    expect(rows[0]!.restaurantName).toBe("Sonic");
    expect(dealRows(snap)).toEqual([]);
  });
});
