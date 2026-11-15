import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadSnapshot, normalizeItems, itemRows, dealRows, wholeCalories, displayName,
  PIZZA_HUT_SLUG, type PizzaHutSnapshot,
} from "../src/modules/adapters/pizzahut";

const snap = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "pizzahut", "33613.json"), "utf8"),
) as PizzaHutSnapshot;

describe("pizzahut snapshot adapter", () => {
  it("loads the committed 33613 snapshot and rejects uncovered ZIPs", () => {
    const loaded = loadSnapshot("33613");
    expect(loaded).not.toBeNull();
    expect(loaded!.storeId).toBe("038698");
    expect(loaded!.storeAddress).toContain("Fowler");
    expect(loadSnapshot("99999")).toBeNull();
  });

  it("converts composite per-unit nutrition to whole-item using official unit counts", () => {
    // Snapshot cal values are the composite the site itself displays
    // (variant base + default modifiers), verified 2026-11-15.
    expect(wholeCalories({ cal: 323, serv: 8 })).toBe(2584); // large pizza, 8 slices
    expect(wholeCalories({ cal: 100, serv: 4 })).toBe(400);  // 4pc wings
    expect(wholeCalories({ cal: 1170, serv: 1 })).toBe(1170); // whole melt
    expect(wholeCalories({ cal: null, serv: 8 })).toBeNull();
    expect(wholeCalories({ cal: 323, serv: null })).toBeNull(); // never guessed
  });

  it("normalizes variants with exact store prices, never invented nutrition", () => {
    const items = normalizeItems(snap);
    expect(items.length).toBeGreaterThan(500);
    for (const i of items) {
      expect(i.restaurantSlug).toBe(PIZZA_HUT_SLUG);
      expect(i.pricingType).toBe("exact_store");
      expect(i.storeId).toBe("038698");
      expect(i.price).toBeGreaterThan(0);
      expect(i.proteinG).toBeNull();
      expect(i.priceSourceUrl).toContain("pizzahut.com");
    }
    const pep = items.find((i) => /Hand-Tossed Pepperoni Pizza$/.test(i.name) && /Large/.test(i.name))!;
    expect(pep.price).toBeGreaterThan(10);
    expect(pep.calories).toBe(2584); // 323 composite cal/slice x 8 slices, matches the site's own display
  });

  it("keeps calories unknown for categories without verified composition", () => {
    const items = normalizeItems(snap);
    const verified = new Set(["pizza", "wings", "melts", "sides", "pasta", "sweets", "drinks", "deals-and-combos"]);
    for (const i of items) {
      if (verified.has(i.category)) continue;
      expect(i.calories).toBeNull(); // unverified category (dips/sauces): unknown stays unknown
    }
  });

  it("cleans the size-marker artifact out of variant display names", () => {
    expect(displayName("Medium v Hand-Tossed Cheese Pizza")).toBe("Medium Hand-Tossed Cheese Pizza");
    expect(displayName("Large Hand-Tossed Pepperoni Pizza")).toBe("Large Hand-Tossed Pepperoni Pizza");
  });

  it("keeps drinks/sweets/sauces categories excluded from entree rankings", () => {
    const items = normalizeItems(snap);
    const cats = new Set(items.map((i) => i.category));
    for (const c of ["pizza", "melts", "wings", "sides", "pasta", "sweets", "sauces", "drinks"]) {
      expect(cats.has(c)).toBe(true);
    }
  });

  it("drops unpriced placeholder rows instead of guessing", () => {
    const withFake = { ...snap, products: [...snap.products, { name: "Ghost", base: "Ghost", sku: "v-0", cat: "pizza", priceCents: 0, cal: 100, serv: 1, unit: "slice", desc: "" }] };
    expect(normalizeItems(withFake).find((i) => i.productId === "v-0")).toBeUndefined();
  });

  it("deal rows are priced online bundles with snapshot freshness and no fake promo codes or expiry", () => {
    const deals = dealRows(snap);
    expect(deals.length).toBeGreaterThan(50);
    for (const d of deals) {
      expect(d.restaurantName).toBe("Pizza Hut");
      expect(d.price).toBeGreaterThan(0);
      expect(d.promoCode).toBeNull(); // internal bundle codes are not customer promo codes
      expect(d.expiresAt).toBeNull();
      expect(d.lastVerified).toBe(snap.fetchedAt);
      expect(d.appOnly).toBe(false);
      expect(d.redemption).toBe("online");
    }
  });

  it("item rows match the RankableRow shape used by the data loader", () => {
    for (const r of itemRows(snap).slice(0, 10)) {
      expect(r.restaurantName).toBe("Pizza Hut");
      expect(typeof r.productId).toBe("string");
      expect(typeof r.fetchedAt).toBe("string");
    }
  });
});
