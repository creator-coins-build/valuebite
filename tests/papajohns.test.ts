import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  loadSnapshot, normalizeItems, itemRows, dealRows, wholeCalories,
  PAPA_JOHNS_SLUG, type PapaJohnsSnapshot,
} from "../src/modules/adapters/papajohns";

const snap = JSON.parse(
  readFileSync(join(__dirname, "..", "data", "papajohns", "33613.json"), "utf8"),
) as PapaJohnsSnapshot;

describe("papajohns snapshot adapter", () => {
  it("loads the committed 33613 snapshot and rejects uncovered ZIPs", () => {
    const loaded = loadSnapshot("33613");
    expect(loaded).not.toBeNull();
    expect(loaded!.storeId).toBe(920);
    expect(loaded!.storeAddress).toContain("Dale Mabry");
    expect(loadSnapshot("99999")).toBeNull();
  });

  it("converts per-slice pizza calories to whole-item using the official slice count", () => {
    expect(wholeCalories({ calories: 210, servingLabel: "/slice, 6 slices" })).toBe(1260);
    expect(wholeCalories({ calories: 360, servingLabel: "/slice, 8 slices" })).toBe(2880);
    expect(wholeCalories({ calories: 790, servingLabel: "", name: "Philly Cheesesteak Oven-Toasted Sandwich" })).toBe(790); // sandwich: already whole-item
    expect(wholeCalories({ calories: 100, servingLabel: "/square, 9 squares" })).toBe(900);
    expect(wholeCalories({ calories: 100, servingLabel: "" })).toBeNull();
    expect(wholeCalories({ calories: 100, servingLabel: "/12 oz" })).toBeNull();
    expect(wholeCalories({ calories: null, servingLabel: "" })).toBeNull();
  });

  it("normalizes products with exact store prices, never invented nutrition", () => {
    const items = normalizeItems(snap);
    expect(items.length).toBeGreaterThan(150);
    for (const i of items) {
      expect(i.restaurantSlug).toBe(PAPA_JOHNS_SLUG);
      expect(i.pricingType).toBe("exact_store");
      expect(i.storeId).toBe("920");
      expect(i.price).toBeGreaterThan(0);
      expect(i.proteinG).toBeNull(); // not in the feed - unknown stays unknown
      expect(i.priceSourceUrl).toContain("papajohns.com");
    }
    const pep = items.find((i) => i.name === "10 Inch Original Pepperoni Pizza")!;
    expect(pep.price).toBe(14.49);
    expect(pep.calories).toBe(1260); // 210 x 6 slices
    const sandwich = items.find((i) => /Philly Cheesesteak Oven/.test(i.name))!;
    expect(sandwich.calories).toBe(790); // whole-item, not multiplied
  });

  it("maps categories so drinks/sweets/sauces stay out of entree rankings", () => {
    const items = normalizeItems(snap);
    const byCat = new Map(items.map((i) => [i.category, true]));
    expect(byCat.has("pizza")).toBe(true);
    expect(byCat.has("sandwiches")).toBe(true);
    expect(byCat.has("wings")).toBe(true);
    expect(byCat.has("drinks")).toBe(true);
    expect(byCat.has("sweets")).toBe(true);
    expect(byCat.has("sauces")).toBe(true);
  });

  it("drops items with no real price instead of guessing", () => {
    const withFake = { ...snap, products: [...snap.products, { name: "Mystery", sku: "X-0", cat: "pizza", price: ".00", regular: ".00", calories: 100, servingLabel: "", desc: "", image: null }] };
    expect(normalizeItems(withFake).find((i) => i.productId === "X-0")).toBeUndefined();
  });

  it("deal rows carry official offer codes and snapshot freshness, never invented expiry", () => {
    const deals = dealRows(snap);
    expect(deals.length).toBe(15);
    for (const d of deals) {
      expect(d.restaurantName).toBe("Papa John's");
      expect(d.lastVerified).toBe(snap.fetchedAt);
      expect(d.expiresAt).toBeNull();
      expect(d.appOnly).toBe(false);
      expect(d.redemption).toBe("online");
    }
    expect(deals.find((d) => d.title === "Papa Pairings")!.description).toContain("two or more");
    expect(deals.find((d) => d.title === "20% Off")!.promoCode).toBe("PJ20OFF");
    expect(deals.find((d) => d.title === "20% Off")!.price).toBeNull(); // percent deal, no fixed price
    expect(deals.find((d) => d.title === "The Grand Papa Pizza")!.price).toBe(14.99);
  });

  it("item rows match the RankableRow shape used by the data loader", () => {
    const rows = itemRows(snap);
    for (const r of rows.slice(0, 10)) {
      expect(r.restaurantName).toBe("Papa John's");
      expect(typeof r.productId).toBe("string");
      expect(typeof r.fetchedAt).toBe("string");
    }
  });
});
