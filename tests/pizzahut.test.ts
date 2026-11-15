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

  it("suppresses all calories until the site's composite nutrition is verified", () => {
    // Feed variant calories are base-only; the site displays base + default
    // modifiers (176/slice feed vs 323/slice displayed). Unknown stays unknown.
    expect(wholeCalories({ cal: 320, serv: 8 })).toBeNull();
    expect(wholeCalories({ cal: 100, serv: 4 })).toBeNull();
    expect(wholeCalories({ cal: 1170, serv: 1 })).toBeNull();
    expect(wholeCalories({ cal: null, serv: 8 })).toBeNull();
    expect(wholeCalories({ cal: 320, serv: null })).toBeNull();
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
    expect(pep.calories).toBeNull(); // suppressed: feed value is base-only, site displays a composite
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
