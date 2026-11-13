import type { NormalizedItem } from "../adapters/types";

/**
 * Entree filter for rankings (spec: never let sauces/packets dominate best-value lists).
 * An item is rankable-as-entree when it is a real food item, not a condiment,
 * drink, side, sweet, or multi-serving pack, and meets a minimum calorie bar.
 */
export interface EntreeRule {
  /** Minimum calories to count as an entree. Default 150. */
  minCalories: number;
  /** Category codes that are never entrees. */
  excludedCategories: ReadonlySet<string>;
}

export const DEFAULT_EXCLUDED_CATEGORIES = new Set([
  "sauces", "drinks", "sides", "sides-sweets", "sweets", "party-packs",
]);

export const DEFAULT_ENTREE_RULE: EntreeRule = {
  minCalories: 150,
  excludedCategories: DEFAULT_EXCLUDED_CATEGORIES,
};

export function isEntree(item: Pick<NormalizedItem, "calories" | "category">, rule: EntreeRule = DEFAULT_ENTREE_RULE): boolean {
  if (rule.excludedCategories.has(item.category)) return false;
  if (item.calories === null || item.calories < rule.minCalories) return false;
  return true;
}

export function entrees<T extends Pick<NormalizedItem, "calories" | "category">>(items: T[], rule: EntreeRule = DEFAULT_ENTREE_RULE): T[] {
  return items.filter((i) => isEntree(i, rule));
}

/** Rank helpers. Rows with null metric sort last; ordering is deterministic (ties broken by name, then productId). */
type Rankable = Pick<NormalizedItem, "name" | "productId">;

function byMetric<T extends Rankable>(metric: (i: T) => number | null, dir: "desc" | "asc") {
  return (a: T, b: T): number => {
    const ma = metric(a), mb = metric(b);
    if (ma === null && mb === null) return a.name.localeCompare(b.name) || a.productId.localeCompare(b.productId);
    if (ma === null) return 1;
    if (mb === null) return -1;
    if (ma !== mb) return dir === "desc" ? mb - ma : ma - mb;
    return a.name.localeCompare(b.name) || a.productId.localeCompare(b.productId);
  };
}

export function rankByCalPerDollar<T extends Rankable & Pick<NormalizedItem, "calories" | "price">>(items: T[]): T[] {
  return [...items].sort(byMetric((i) => (i.calories !== null && i.price > 0 ? i.calories / i.price : null), "desc"));
}

export function rankByProteinPerDollar<T extends Rankable & Pick<NormalizedItem, "proteinG" | "price">>(items: T[]): T[] {
  return [...items].sort(byMetric((i) => (i.proteinG !== null && i.price > 0 ? i.proteinG / i.price : null), "desc"));
}

export function rankCheapest<T extends Rankable & Pick<NormalizedItem, "price">>(items: T[]): T[] {
  return [...items].sort(byMetric((i) => (i.price > 0 ? i.price : null), "asc"));
}
