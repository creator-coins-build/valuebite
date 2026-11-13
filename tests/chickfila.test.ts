import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseNutritionHtml, extractEmbeddedObjects } from "../src/modules/adapters/chickfila";

const snippet = readFileSync(join(__dirname, "fixtures", "cfa-nutrition-snippet.html"), "utf8");

describe("chick-fil-a nutrition parser", () => {
  it("extracts embedded item objects with brace balancing", () => {
    const objs = [...extractEmbeddedObjects(snippet)];
    expect(objs.length).toBeGreaterThanOrEqual(2);
    for (const o of objs) expect(() => JSON.parse(o)).not.toThrow();
  });

  it("parses real calories and protein from official page JSON", () => {
    const items = parseNutritionHtml(snippet);
    const minis10 = items.find((i) => i.id === "38480");
    expect(minis10).toBeDefined();
    expect(minis10!.title).toBe("10 ct Chick-fil-A Chick-n-Minis®");
    expect(minis10!.calories).toBe(910);
    expect(minis10!.proteinG).toBeGreaterThan(0);
    expect(minis10!.link).toContain("chick-fil-a.com/menu/");
  });

  it("also picks up nested sub_items entries", () => {
    const items = parseNutritionHtml(snippet);
    // 10147 (Chick-n-Minis) nests 10149 (4 ct) in sub_items; both are real items
    expect(items.some((i) => i.id === "10147")).toBe(true);
    expect(items.some((i) => i.id === "10149")).toBe(true);
  });

  it("skips malformed JSON instead of guessing", () => {
    const items = parseNutritionHtml('{"ID":1,"title":"Broken","fields":[{"label":"Calories","value":100}');
    expect(items).toEqual([]);
  });

  it("skips objects without the item shape", () => {
    const items = parseNutritionHtml('{"ID":5,"title":"No fields here"}');
    expect(items).toEqual([]);
  });

  it("unknown nutrition stays unknown", () => {
    const items = parseNutritionHtml('{"ID":7,"title":"Mystery","fields":[]}');
    expect(items).toHaveLength(1);
    expect(items[0]!.calories).toBeNull();
    expect(items[0]!.proteinG).toBeNull();
  });

  it("dedupes repeated ids", () => {
    const one = '{"ID":9,"title":"A","fields":[{"label":"Calories","value":200}]}';
    const items = parseNutritionHtml(one + one);
    expect(items.filter((i) => i.id === "9")).toHaveLength(1);
  });
});
