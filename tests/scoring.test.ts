import { describe, it, expect } from "vitest";
import { scorePopulation, rank, explain, labelFor, percentile, logNormalize, validate } from "@/modules/scoring/engine";
import { dealTotals } from "@/modules/scoring/deals";

const it1 = (id: string, price: any, calories: any, protein: any) => ({ id, price, calories, protein });

describe("spec examples", () => {
  it("cal/$: 1700/13.48 = 126, 2000/11.99 = 167", () => {
    const r = scorePopulation([it1("a", 13.48, 1700, 50), it1("b", 11.99, 2000, 60)]);
    expect(Math.round(r[0]!.calPerDollar!)).toBe(126);
    expect(Math.round(r[1]!.calPerDollar!)).toBe(167);
  });
  it("protein/$: $10, 50g = 5", () => {
    expect(scorePopulation([it1("a", 10, 800, 50)])[0]!.proteinPerDollar).toBe(5);
  });
});

describe("determinism and bounds", () => {
  const pop = [it1("a", 5, 980, 31), it1("b", 2, 190, 9), it1("c", 8.49, 1545, 52), it1("d", 30, 5000, 200), it1("e", 6, 600, 20), it1("f", 4, 450, 12)];
  it("is reproducible and order independent", () => {
    const x = scorePopulation(pop), y = scorePopulation([...pop].reverse());
    for (const r of x) expect(y.find(z => z.id === r.id)).toEqual(r);
    expect(scorePopulation(pop)).toEqual(x);
  });
  it("scores within 0..10 and uses population normalization when n>=5", () => {
    for (const r of scorePopulation(pop)) { expect(r.valueScore!).toBeGreaterThanOrEqual(0); expect(r.valueScore!).toBeLessThanOrEqual(10); expect(r.normalization).toBe("population"); }
  });
  it("small population uses fixed reference bounds", () => {
    expect(scorePopulation(pop.slice(0, 2))[0]!.normalization).toBe("reference");
  });
  it("outlier $30 family bundle does not push a $2 item to zero", () => {
    const r = scorePopulation(pop);
    expect(r.find(z => z.id === "b")!.priceScore!).toBeGreaterThan(0.5);
  });
  it("monotonic: more protein for same price scores higher", () => {
    const r = scorePopulation([...pop, it1("hi", 8, 1000, 60), it1("lo", 8, 1000, 20)]);
    expect(r.find(z => z.id === "hi")!.valueScore!).toBeGreaterThan(r.find(z => z.id === "lo")!.valueScore!);
  });
  it("hand-checked reference score", () => {
    // reference mode: calPerDollar=200 -> ln(200/30)/ln(10)=0.8239 ; protein/$=10 -> ln(10)/ln(20)=0.7686 ; price 5 -> 1-ln5/ln20=0.4627
    const r = scorePopulation([it1("x", 5, 1000, 50)])[0]!;
    expect(r.calorieScore).toBeCloseTo(0.8239, 3);
    expect(r.proteinScore).toBeCloseTo(0.7686, 3);
    expect(r.priceScore).toBeCloseTo(0.4627, 3);
    expect(r.valueScore).toBe(Math.round((0.55 * r.proteinScore! + 0.35 * r.calorieScore! + 0.1 * r.priceScore!) * 100) / 10);
  });
});

describe("safety", () => {
  it("rejects bad records and never ranks them", () => {
    const bad = [it1("z", 0, 500, 10), it1("n", -1, 500, 10), it1("m", null, 500, 10), it1("c", 5, null, 10), it1("nc", 5, -5, 10),
      it1("np", 5, 500, -1), it1("big", 5, 50000, 10), it1("pp", 5, 100, 100), it1("pr", 500, 500, 10)];
    const res = scorePopulation(bad);
    expect(res.every(r => !r.valid && r.valueScore === null)).toBe(true);
    expect(rank(res, "value")).toHaveLength(0);
  });
  it("flags duplicate ids", () => {
    const r = scorePopulation([it1("a", 5, 500, 10), it1("a", 6, 600, 12)]);
    expect(r[1]!.invalidReasons).toContain("duplicate_id");
  });
  it("unknown protein is not 0: no value score, still ranks on calories", () => {
    const r = scorePopulation([it1("u", 5, 800, null), it1("k", 5, 800, 30)]);
    expect(r[0]!.valid).toBe(true);
    expect(r[0]!.valueScore).toBeNull();
    expect(r[0]!.proteinPerDollar).toBeNull();
    expect(rank(r, "value").map(x => x.id)).toEqual(["k"]);
    expect(rank(r, "calPerDollar").map(x => x.id)).toEqual(["k", "u"]);
  });
  it("zero protein known is scored as zero protein", () => {
    const r = scorePopulation([it1("s", 2, 300, 0)])[0]!;
    expect(r.proteinScore).toBe(0);
  });
  it("validate returns reasons", () => { expect(validate(it1("a", 0, 1, 1))).toEqual(["nonpositive_price"]); });
});

describe("ranking", () => {
  it("ranks by mode with deterministic ties", () => {
    const res = scorePopulation([it1("b", 5, 500, 20), it1("a", 5, 500, 20), it1("c", 2, 500, 20)]);
    expect(rank(res, "cheapest").map(r => r.id)).toEqual(["c", "a", "b"]);
    expect(rank(res, "calPerDollar").map(r => r.id)).toEqual(["c", "a", "b"]);
  });
});

describe("labels, explain, helpers", () => {
  it("label thresholds", () => {
    expect([9, 9.9, 8, 8.9, 7, 7.9, 5, 6.9, 4.9, 0].map(labelFor)).toEqual(["Excellent", "Excellent", "Great", "Great", "Good", "Good", "Average", "Average", "Poor", "Poor"]);
  });
  it("explain exposes numbers", () => {
    const s = explain(scorePopulation([it1("a", 8.49, 1545, 52)])[0]!);
    expect(s).toMatch(/cal\/\$/); expect(s).toContain("$8.49"); expect(s).toContain("1545 cal"); expect(s).toContain("52g protein");
  });
  it("percentile and logNormalize", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(logNormalize(10, 1, 100)).toBeCloseTo(0.5);
    expect(logNormalize(1000, 1, 100)).toBe(1);
    expect(logNormalize(5, 5, 5)).toBe(0.5);
  });
});

describe("deals", () => {
  it("2 sandwiches for $6 = 2x nutrition", () => {
    expect(dealTotals([{ quantity: 2, calories: 400, protein: 20 }])).toEqual({ calories: 800, protein: 40 });
    const t = dealTotals([{ quantity: 2, calories: 400, protein: 20 }]);
    expect(scorePopulation([{ id: "d", price: 6, ...t }])[0]!.calPerDollar).toBeCloseTo(133.3, 1);
  });
  it("BOGO on $6 item: effective $6, two items", () => {
    const t = dealTotals([{ quantity: 2, calories: 500, protein: 25 }]);
    expect(scorePopulation([{ id: "b", price: 6, ...t }])[0]!.proteinPerDollar).toBeCloseTo(8.33, 2);
  });
  it("unknown protein propagates", () => { expect(dealTotals([{ quantity: 1, calories: 100, protein: null }]).protein).toBeNull(); });
});
