import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseZipResponse, parseDominosLocator, parseTacoBellLocator } from "../src/modules/location/resolve";

const fx = (n: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", n), "utf8"));

describe("ZIP -> store resolution", () => {
  it("parses ZIP centroid", () => {
    const geo = parseZipResponse(fx("zip-33613.json"));
    expect(geo).not.toBeNull();
    expect(geo!.lat).toBeCloseTo(28.0772, 3);
    expect(geo!.lon).toBeCloseTo(-82.4455, 3);
    expect(geo!.city).toBe("Tampa");
  });

  it("rejects a ZIP response without coordinates", () => {
    expect(parseZipResponse({})).toBeNull();
    expect(parseZipResponse({ places: [{}] })).toBeNull();
  });

  it("parses Domino's locator into stores with coordinates", () => {
    const stores = parseDominosLocator(fx("dominos-locator-33613.json"));
    expect(stores).toHaveLength(10);
    const s3813 = stores.find((s) => s.storeId === "3813");
    expect(s3813).toBeDefined();
    expect(s3813!.address).toContain("14955 N Florida Ave");
    expect(s3813!.zip).toBe("33613");
    expect(s3813!.lat).toBeCloseTo(28.086904, 4);
  });

  it("parses Taco Bell locator into stores", () => {
    const stores = parseTacoBellLocator(fx("tacobell-locator-33613.json"));
    expect(stores).toHaveLength(12);
    const bearss = stores.find((s) => s.storeId === "036133");
    expect(bearss).toBeDefined();
    expect(bearss!.address).toContain("2031 E Bearss Ave");
    expect(bearss!.zip).toBe("33613");
  });

  it("skips stores without id or address instead of guessing", () => {
    expect(parseDominosLocator({ Stores: [{ StoreID: "1" }, { Address: { Street: "x" } }, null] })).toHaveLength(0);
    expect(parseTacoBellLocator({ nearByStores: [{ storeNumber: "2" }, { address: { line1: "y" } }] })).toHaveLength(0);
  });
});
