import type { CfaNutritionItem } from "./chickfila";
import type { NormalizedItem } from "./types";

/**
 * Pairs official Chick-fil-A nutrition (chickfila.com, exact) with Drive Thru
 * Index typical prices (Level 4 national_estimate). The estimate carries its
 * source URL and checked date; UI must label it "Typical price - may vary".
 * Never presented as exact (spec + Dylan's fallback rule, 2026-11-13).
 */

export interface CfaPriceEstimate {
  slug: string;
  itemName: string;
  typical: number;
  low: number;
  high: number;
  storeCount: number;
  checkedDate: string;
  sourceUrl: string;
}

/** "10 ct Chick-fil-A Chick-n-Minis®" -> "10-ct-chick-fil-a-chick-n-minis" */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[®™©]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function matchEstimate(item: CfaNutritionItem, estimates: CfaPriceEstimate[]): CfaPriceEstimate | null {
  const slug = slugify(item.title);
  return estimates.find((e) => e.slug === slug) ?? null;
}

/**
 * The CFA nutrition page has no category codes, so derive a coarse category
 * from the item name. This keeps sides (waffle fries, filets a la carte) out
 * of entree rankings. Only used for filtering - never affects stored numbers.
 */
export function categorize(title: string): string {
  const t = title.toLowerCase();
  if (/salad/.test(t)) return "salads";
  if (/sandwich|club/.test(t)) return "sandwiches"; // before waffle: "Chicken Waffles Sandwich" is a sandwich
  if (/wrap/.test(t)) return "wraps";
  if (/waffle|side|sauce|dip|dressing/.test(t)) return "sides";
  if (/nugget|strip|filet/.test(t)) return "nuggets-strips";
  return "entree";
}

export function toNormalizedItems(
  nutrition: CfaNutritionItem[],
  estimates: CfaPriceEstimate[],
  ctx: { zip: string; fetchedAt: Date },
): { items: NormalizedItem[]; unmatchedPriced: CfaNutritionItem[] } {
  const items: NormalizedItem[] = [];
  const unmatchedPriced: CfaNutritionItem[] = [];
  for (const n of nutrition) {
    const est = matchEstimate(n, estimates);
    if (!est) continue; // no honest price -> no row (never invent one)
    items.push({
      restaurantSlug: "chick-fil-a",
      productId: n.id,
      name: n.title,
      description: null,
      category: categorize(n.title),
      calories: n.calories,
      proteinG: n.proteinG,
      nutritionSourceUrl: "https://www.chick-fil-a.com/nutrition-allergens",
      nutritionConfidence: "high",
      price: est.typical,
      pricingType: "national_estimate",
      priceSourceUrl: est.sourceUrl,
      storeId: "",
      zip: ctx.zip,
      fetchedAt: ctx.fetchedAt.toISOString(),
    });
  }
  return { items, unmatchedPriced };
}
