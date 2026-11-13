import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DominosAdapter, normalizeCoupons } from "../src/modules/adapters/dominos";
import { validateRun } from "../src/modules/ingestion/validate";

const fixture = JSON.parse(
  readFileSync(join(__dirname, "fixtures", "dominos-3813-menu.json"), "utf8"),
);
const ctx = {
  storeId: "3813",
  zip: "33613",
  fetchedAt: new Date("2026-11-13T12:00:00Z"),
  sourceUrl: "https://order.dominos.com/power/store/3813/menu?lang=en&structured=true",
};

describe("dominos adapter", () => {
  const items = DominosAdapter.normalizeItems(fixture, ctx);

  it("extracts one row per priced variant with exact store prices", () => {
    expect(items.length).toBe(222);
    for (const i of items.filter((i) => i.productId !== "STJUDERU")) {
      expect(i.price).toBeGreaterThan(0);
      expect(i.pricingType).toBe("exact_store");
      expect(i.storeId).toBe("3813");
    }
  });

  it("nutrition is unknown, never guessed", () => {
    for (const i of items) {
      expect(i.calories).toBeNull();
      expect(i.proteinG).toBeNull();
    }
  });

  it("validation accepts priced variants when the source has no nutrition feed", () => {
    const v = validateRun(items, undefined, { requireCalories: false });
    // the single rejection is STJUDERU, a $0 donation prompt - correctly dropped
    expect(v.rejected).toHaveLength(1);
    expect(v.rejected[0]!.item.productId).toBe("STJUDERU");
    expect(v.rejected[0]!.reason).toBe("bad_price");
    expect(v.accepted).toHaveLength(221);
    expect(v.anomalies).toHaveLength(0);
  });

  it("coupons come only from the official feed, with dates and last-checked", () => {
    const coupons = normalizeCoupons(fixture, ctx);
    expect(coupons.length).toBe(26);
    for (const c of coupons) {
      expect(c.code.length).toBeGreaterThan(0);
      expect(c.sourceUrl).toContain("order.dominos.com");
      expect(c.lastChecked).toBe(ctx.fetchedAt.toISOString());
    }
    const withExpiry = coupons.filter((c) => c.expiresOn);
    expect(withExpiry.length).toBeGreaterThan(0);
    const paze = coupons.find((c) => c.code === "PAZE35OFF");
    expect(paze?.expiresOn).toBe("2026-11-30");
    const priced = coupons.filter((c) => c.price !== null);
    expect(priced.length).toBeGreaterThan(0);
  });
});
