import { ScoreInput, ScoreResult, Invalid, ValueLabel, VALUE_SCORE_VERSION } from "./types";

/** Documented in docs/value-score-v1.md. Changing any constant requires a new version. */
export const V1 = {
  weights: { protein: 0.55, calories: 0.35, price: 0.10 },
  /** Used when the comparison population is smaller than minPopulation. */
  referenceBounds: { calPerDollar: [30, 300], proteinPerDollar: [1, 20], price: [1, 20] },
  minPopulation: 5,
  /** Population bounds are the 5th and 95th percentile of the log metric. */
  lowPct: 0.05,
  highPct: 0.95,
  sanity: { maxCalories: 10000, maxProtein: 600, maxPrice: 200, maxProteinCalorieShare: 1.0 },
  labels: [[9.0, "Excellent"], [8.0, "Great"], [7.0, "Good"], [5.0, "Average"]] as [number, ValueLabel][],
} as const;

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function labelFor(score: number | null): ValueLabel | null {
  if (score === null) return null;
  for (const [min, l] of V1.labels) if (score >= min) return l;
  return "Poor";
}

/** Linear-interpolated percentile of a sorted array (p in 0..1). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) throw new Error("empty");
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** log-scale min-max between [lo, hi]; clamped to 0..1. Degenerate range -> 0.5. */
export function logNormalize(value: number, lo: number, hi: number): number {
  const a = Math.log(lo), b = Math.log(hi);
  if (b - a < 1e-9) return 0.5;
  return clamp01((Math.log(value) - a) / (b - a));
}

export function validate(i: ScoreInput): Invalid[] {
  const r: Invalid[] = [];
  if (!isNum(i.price)) r.push("missing_price");
  else if (i.price <= 0) r.push("nonpositive_price");
  else if (i.price > V1.sanity.maxPrice) r.push("unreasonable_price");
  if (!isNum(i.calories)) r.push("missing_calories");
  else if (i.calories < 0) r.push("negative_calories");
  else if (i.calories > V1.sanity.maxCalories) r.push("unreasonable_calories");
  if (isNum(i.protein)) {
    if (i.protein < 0) r.push("negative_protein");
    else if (i.protein > V1.sanity.maxProtein) r.push("unreasonable_protein");
    else if (isNum(i.calories) && i.calories >= 0 && i.protein * 4 > i.calories * 1.05 + 20) r.push("protein_exceeds_calorie_limit");
  }
  return r;
}

interface Bounds { cal: [number, number]; pro: [number, number]; price: [number, number]; mode: "population" | "reference" }

function boundsFor(valid: ScoreInput[]): Bounds {
  const cals = valid.filter(i => i.calories! > 0).map(i => i.calories! / i.price!).sort((a, b) => a - b);
  const pros = valid.filter(i => isNum(i.protein) && i.protein > 0).map(i => i.protein! / i.price!).sort((a, b) => a - b);
  const R = V1.referenceBounds;
  const enough = cals.length >= V1.minPopulation && pros.length >= V1.minPopulation;
  if (!enough) return { cal: [...R.calPerDollar] as [number, number], pro: [...R.proteinPerDollar] as [number, number], price: [...R.price] as [number, number], mode: "reference" };
  return {
    cal: [percentile(cals, V1.lowPct), percentile(cals, V1.highPct)],
    pro: [percentile(pros, V1.lowPct), percentile(pros, V1.highPct)],
    price: [...R.price] as [number, number],
    mode: "population",
  };
}

/**
 * Score a comparison population. Pure and deterministic: same inputs -> same outputs.
 * Value is only meaningful within one population (context), per spec s30.
 */
export function scorePopulation(items: ScoreInput[]): ScoreResult[] {
  const seen = new Set<string>();
  const checked = items.map(i => {
    const reasons = validate(i);
    if (seen.has(i.id)) reasons.push("duplicate_id");
    seen.add(i.id);
    return { i, reasons };
  });
  const good = checked.filter(c => c.reasons.length === 0).map(c => c.i);
  const b = boundsFor(good);

  return checked.map(({ i, reasons }) => {
    const base: ScoreResult = {
      id: i.id, version: VALUE_SCORE_VERSION, valid: reasons.length === 0, invalidReasons: reasons,
      price: isNum(i.price) ? i.price : null, calories: isNum(i.calories) ? i.calories : null,
      protein: isNum(i.protein) ? i.protein : null,
      calPerDollar: null, proteinPerDollar: null, calorieScore: null, proteinScore: null, priceScore: null,
      valueScore: null, label: null, normalization: b.mode,
    };
    if (reasons.length) return base;
    const price = i.price!;
    base.calPerDollar = round(i.calories! / price, 1);
    base.priceScore = round(1 - logNormalize(price, b.price[0], b.price[1]), 4);
    base.calorieScore = i.calories! > 0 ? round(logNormalize(i.calories! / price, b.cal[0], b.cal[1]), 4) : 0;
    if (isNum(i.protein)) {
      base.proteinPerDollar = round(i.protein / price, 2);
      base.proteinScore = i.protein > 0 ? round(logNormalize(i.protein / price, b.pro[0], b.pro[1]), 4) : 0;
      const w = V1.weights;
      const raw = w.protein * base.proteinScore + w.calories * base.calorieScore + w.price * base.priceScore;
      base.valueScore = round(raw * 10, 1);
      base.label = labelFor(base.valueScore);
    }
    return base;
  });
}

export type RankMode = "value" | "calPerDollar" | "proteinPerDollar" | "cheapest";

/** Ranks only valid records that have the metric needed for the mode. Ties break by id for determinism. */
export function rank(results: ScoreResult[], mode: RankMode): ScoreResult[] {
  const key = (r: ScoreResult): number | null =>
    mode === "value" ? r.valueScore : mode === "calPerDollar" ? r.calPerDollar
    : mode === "proteinPerDollar" ? r.proteinPerDollar : r.price === null ? null : -r.price;
  return results.filter(r => r.valid && key(r) !== null)
    .sort((a, b) => (key(b)! - key(a)!) || a.id.localeCompare(b.id));
}

export function explain(r: ScoreResult): string {
  if (!r.valid) return `Not ranked: ${r.invalidReasons.join(", ")}`;
  const parts = [
    r.valueScore !== null ? `${r.valueScore.toFixed(1)} Value Score (${r.label})` : "Value Score unavailable (protein unknown)",
    `${Math.round(r.calPerDollar!)} cal/$`,
    r.proteinPerDollar !== null ? `${r.proteinPerDollar.toFixed(1)}g protein/$` : "protein unknown",
    `$${r.price!.toFixed(2)}`, `${Math.round(r.calories!)} cal`,
    r.protein !== null ? `${Math.round(r.protein)}g protein` : "protein unknown",
  ];
  return parts.join(", ");
}
