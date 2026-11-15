import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { TacoBellAdapter, exclusiveDeals } from "@/modules/adapters/tacobell";
import { validateRun } from "@/modules/ingestion/validate";
import { scorePopulation, rank } from "@/modules/scoring/engine";

const raw = JSON.parse(fs.readFileSync("tests/fixtures/tacobell-036133-menu.json", "utf8"));
const ctx = { storeId: "036133", zip: "33613", fetchedAt: new Date("2026-11-12T21:00:00Z"), sourceUrl: "https://www.tacobell.com/tacobellwebservices/v4/tacobell/products/menu/036133" };

describe("taco bell adapter (real captured fixture)", () => {
  const items = TacoBellAdapter.normalizeItems(raw, ctx);
  const v = validateRun(items);
  it("normalizes real items and is not quarantined", () => {
    expect(items.length).toBeGreaterThan(50);
    expect(v.quarantine).toBe(false);
    expect(v.accepted.length).toBeGreaterThan(30);
  });
  it("chalupa supreme has real price/cal from feed", () => {
    const c = v.accepted.find(i => i.productId === "22850")!;
    expect(c.calories).toBe(350); expect(c.price).toBeGreaterThan(1); expect(c.proteinG).toBeNull(); expect(c.pricingType).toBe("exact_store");
  });
  it("ranks by cal/$ without inventing protein", () => {
    const scored = scorePopulation(v.accepted.map(i => ({ id: i.productId, price: i.price, calories: i.calories, protein: i.proteinG })));
    const top = rank(scored, "calPerDollar");
    expect(top.length).toBeGreaterThan(30);
    expect(rank(scored, "value")).toHaveLength(0); // protein unknown -> no Value Score
  });
  it("quarantines broken runs", () => {
    expect(validateRun([]).quarantine).toBe(true);
    const doubled = v.accepted.map(i => ({ ...i, price: i.price * 2 }));
    expect(validateRun(doubled, v.accepted).quarantine).toBe(true);
    expect(validateRun(v.accepted.map(i => ({ ...i, price: 0 }))).quarantine).toBe(true);
  });
});


describe("app/online exclusives (official categories)", () => {
  it("extracts member-exclusive and online-exclusive products only", () => {
    const x = exclusiveDeals(raw);
    expect(x.length).toBeGreaterThan(0);
    expect(x.every(e => e.kind === "online")).toBe(true); // membership alone never proves app-only
    expect(exclusiveDeals({menuProductCategories:[{code:"member-exclusive",products:[{code:"x", name:"Unavailable",isAvailableInStore:false}]}]})).toHaveLength(0);
    // no duplicates from other categories leak in
    const names = new Set(x.map(e => e.name));
    expect(names.size).toBe(x.length);
  });
});
