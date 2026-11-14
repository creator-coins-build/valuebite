import { describe, it, expect } from "vitest";
import { applyFilters, filtersFromParams, describeFilters } from "../src/modules/scoring/filters";

const rows = [
  { price: 5.25, calories: 420, proteinG: 29, restaurantSlug: "chick-fil-a", category: "entree" },
  { price: 1.69, calories: 400, proteinG: null, restaurantSlug: "taco-bell", category: "burritos" },
  { price: 17.25, calories: null, proteinG: null, restaurantSlug: "dominos", category: "Pizza" },
  { price: 8.45, calories: 660, proteinG: 43, restaurantSlug: "chick-fil-a", category: "entree" },
];

describe("filters", () => {
  it("budget keeps only items under the cap", () => {
    const out = applyFilters(rows, { budget: 10 });
    expect(out.map((r) => r.price)).toEqual([5.25, 1.69, 8.45]);
  });

  it("restaurant filter keeps only named restaurants", () => {
    const out = applyFilters(rows, { restaurants: ["taco-bell"] });
    expect(out).toHaveLength(1);
    expect(out[0]!.restaurantSlug).toBe("taco-bell");
  });

  it("min-protein excludes unknown protein instead of treating it as 0", () => {
    const out = applyFilters(rows, { minProteinG: 20 });
    expect(out).toHaveLength(2);
    expect(out.every((r) => (r.proteinG ?? 0) >= 20)).toBe(true);
  });

  it("calorie ranges exclude unknown calories", () => {
    expect(applyFilters(rows, { minCalories: 400 })).toHaveLength(3);
    expect(applyFilters(rows, { maxCalories: 400 })).toHaveLength(1); // only the exact 400; 420/660 excluded, null excluded
  });

  it("filters compose", () => {
    const out = applyFilters(rows, { budget: 10, restaurants: ["chick-fil-a"], minProteinG: 30 });
    expect(out).toHaveLength(1);
    expect(out[0]!.price).toBe(8.45);
  });

  it("parses URL params, dropping junk", () => {
    const f = filtersFromParams({ budget: "10", restaurant: "taco-bell,dominos", minProtein: "abc", maxCalories: "-5" });
    expect(f.budget).toBe(10);
    expect(f.restaurants).toEqual(["taco-bell", "dominos"]);
    expect(f.minProteinG).toBeUndefined();
    expect(f.maxCalories).toBeUndefined();
  });

  it("describes active filters", () => {
    expect(describeFilters({})).toBe("no filters");
    expect(describeFilters({ budget: 10, minProteinG: 20 })).toBe("under $10, at least 20g protein");
  });
});
