import { describe, it, expect } from "vitest";
import data from "../data/digital-offers.json";
import images from "../data/official-images.json";
import { currentDigitalOffers } from "../src/modules/digital-offers";

describe("official digital offers", () => {
  const checked = Date.parse(data.offers[0]!.checkedAt);
  it("hides manually reviewed offers after 48h and rejects future checks", () => {
    expect(currentDigitalOffers(checked + 1000)).toHaveLength(data.offers.length);
    expect(currentDigitalOffers(checked + 48 * 3600_000)).toHaveLength(0);
    expect(currentDigitalOffers(checked - 1)).toHaveLength(0);
  });
  it("does not turn digital membership into an app-only claim", () => {
    expect(data.offers.every(o => o.appOnly === false)).toBe(true);
    for (const o of data.offers) {
      expect(o.eligibility.length).toBeGreaterThan(20);
      expect(o.terms.length).toBeGreaterThan(30);
      expect(o.sourceUrl).toMatch(/^https:\/\//);
      expect(o.evidence.length).toBeGreaterThan(10);
    }
  });
  it("keeps source evidence for every added food photo", () => {
    expect(Object.keys(images)).toHaveLength(7);
    for (const x of Object.values(images)) {
      expect(x.sourceUrl).toBe("https://www.chick-fil-a.com/menu/entrees");
      expect(x.imageUrl).toMatch(/^https:\/\/www\.chick-fil-a\.com\/wp-content\/uploads\//);
    }
    // Do not illustrate an unverified cheese variant with the default photo.
    expect(images).not.toHaveProperty("chick-fil-a:10293");
  });
});
