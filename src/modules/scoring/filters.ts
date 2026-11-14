import type { NormalizedItem } from "../adapters/types";

/**
 * Phase 6 filters: budget, restaurant, category, nutrition.
 * All filters are pure functions over rows; unknown nutrition is never treated
 * as 0 - a min-protein filter excludes unknown-protein rows, it does not
 * pretend they qualify or fail numerically.
 */

export interface FilterSpec {
  /** Max price in USD ("Best Food Under $10"). */
  budget?: number;
  restaurants?: string[];
  categories?: string[];
  minCalories?: number;
  maxCalories?: number;
  minProteinG?: number;
  maxPrice?: number;
}

type Row = Pick<NormalizedItem, "price" | "calories" | "proteinG" | "restaurantSlug" | "category">;

export function applyFilters<T extends Row>(rows: T[], f: FilterSpec): T[] {
  return rows.filter((r) => {
    const budget = f.budget ?? f.maxPrice;
    if (budget !== undefined && r.price > budget) return false;
    if (f.restaurants?.length && !f.restaurants.includes(r.restaurantSlug)) return false;
    if (f.categories?.length && !f.categories.includes(r.category)) return false;
    if (f.minCalories !== undefined && (r.calories === null || r.calories < f.minCalories)) return false;
    if (f.maxCalories !== undefined && (r.calories === null || r.calories > f.maxCalories)) return false;
    if (f.minProteinG !== undefined && (r.proteinG === null || r.proteinG < f.minProteinG)) return false;
    return true;
  });
}

/** Parse URL search params into a FilterSpec. Bad values are dropped, never guessed. */
export function filtersFromParams(params: Record<string, string | string[] | undefined>): FilterSpec {
  const num = (k: string): number | undefined => {
    const v = params[k];
    const n = Number(typeof v === "string" ? v : undefined);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };
  const list = (k: string): string[] | undefined => {
    const v = params[k];
    const s = Array.isArray(v) ? v.join(",") : v;
    const items = s?.split(",").map((x) => x.trim()).filter(Boolean);
    return items?.length ? items : undefined;
  };
  return {
    budget: num("budget"),
    restaurants: list("restaurant"),
    categories: list("category"),
    minCalories: num("minCalories"),
    maxCalories: num("maxCalories"),
    minProteinG: num("minProtein"),
  };
}

/** Human-readable summary of active filters for the page header. */
export function describeFilters(f: FilterSpec): string {
  const parts: string[] = [];
  if (f.budget !== undefined) parts.push(`under $${f.budget}`);
  if (f.restaurants?.length) parts.push(`from ${f.restaurants.join(", ")}`);
  if (f.categories?.length) parts.push(`in ${f.categories.join(", ")}`);
  if (f.minCalories !== undefined) parts.push(`at least ${f.minCalories} cal`);
  if (f.maxCalories !== undefined) parts.push(`at most ${f.maxCalories} cal`);
  if (f.minProteinG !== undefined) parts.push(`at least ${f.minProteinG}g protein`);
  return parts.length ? parts.join(", ") : "no filters";
}
