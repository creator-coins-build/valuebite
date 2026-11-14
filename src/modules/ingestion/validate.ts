import type { NormalizedItem } from "../adapters/types";

export interface Validation { accepted: NormalizedItem[]; rejected: { item: NormalizedItem; reason: string }[]; anomalies: string[]; quarantine: boolean }

export interface ValidateOptions {
  /**
   * Reject rows with null calories. Default true: sources that publish
   * nutrition (Taco Bell) treat a missing number as bad data. Set false for
   * sources with no nutrition feed at all (Domino's) - the row is valid for
   * price display and nutrition stays honestly unknown.
   */
  requireCalories: boolean;
}

/** Per-item: drop unusable rows. Per-run: quarantine whole run on suspicious shape (spec s22). */
export function validateRun(items: NormalizedItem[], previous?: NormalizedItem[], opts: ValidateOptions = { requireCalories: true }): Validation {
  const anomalies: string[] = [];
  const accepted: NormalizedItem[] = [], rejected: Validation["rejected"] = [];
  for (const i of items) {
    const hasRange = typeof i.caloriesMin === "number" && typeof i.caloriesMax === "number";
    let reason = "";
    if (!Number.isFinite(i.price) || i.price <= 0) reason = "bad_price";
    else if (i.calories === null && !hasRange && opts.requireCalories) reason = "calories_missing_or_range";
    else if (i.calories !== null && i.calories <= 0) reason = "nonpositive_calories";
    else if (hasRange && (i.caloriesMin! < 0 || i.caloriesMax! < i.caloriesMin!)) reason = "bad_calorie_range";
    if (reason) rejected.push({ item: i, reason }); else accepted.push(i);
  }
  const ids = items.map(i => i.productId);
  if (new Set(ids).size !== ids.length) anomalies.push("duplicate_product_ids");
  if (items.length === 0) anomalies.push("zero_items");
  if (items.length && accepted.length / items.length < 0.3) anomalies.push("most_items_rejected");
  if (previous && previous.length) {
    const prev = new Map(previous.map(p => [p.productId, p.price]));
    const ratios = accepted.filter(a => prev.has(a.productId)).map(a => a.price / prev.get(a.productId)!);
    if (ratios.length >= 5) {
      const med = ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)]!;
      if (med > 1.5 || med < 0.5) anomalies.push(`median_price_ratio_${med.toFixed(2)}`);
    }
    if (accepted.length < previous.length * 0.5) anomalies.push("item_count_dropped_over_50pct");
  }
  return { accepted, rejected, anomalies, quarantine: anomalies.length > 0 };
}
