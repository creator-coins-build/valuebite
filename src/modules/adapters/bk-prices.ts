import type { NormalizedItem } from "./types";

/**
 * Burger King: official published nutrition PDF (bk.com/nutrition-explorer ->
 * bk-use1-prod.sites.rbictg.com/nutrition/nutrition.pdf, dated Nov 2022, the
 * version BK currently publishes) joined to Drive Thru Index typical prices
 * (Level 4 national_estimate, labeled in UI, never exact).
 *
 * The PDF has no per-size fountain drinks and its Croissan'wich rows lose
 * their names in text extraction, so those DTI items get NO row (never guess).
 * Name matching is an explicit alias map: DTI itemName -> PDF row name.
 */

export interface BkNutritionRow { name: string; calories: number; proteinG: number; }
export interface DtiEstimate {
  slug: string; itemName: string; low: number; high: number; storeCount: number;
  typical: number; checkedDate: string; sourceUrl: string;
}

const BK_PREFIX = /^Burger King /;

const ALIASES: Record<string, string> = {
  "Whopper": "WHOPPER® Sandwich",
  "Whopper with Cheese": "WHOPPER® Sandwich with Cheese",
  "Whopper with Bacon & Cheese": "Bacon & Cheese WHOPPER® Sandwich",
  "Double Whopper": "DOUBLE WHOPPER® Sandwich",
  "Double Whopper with Cheese": "DOUBLE WHOPPER® Sandwich with Cheese",
  "Whopper Jr.": "WHOPPER JR.® Sandwich",
  "Original Chicken Sandwich": "Original Chicken Sandwich",
  "Double Cheeseburger": "Double Cheeseburger",
  "Small French Fries": "French Fries - small*",
  "Medium French Fries": "French Fries - medium*",
  "Large French Fries": "French Fries - large*",
  "Small Onion Rings": "Onion Rings - small",
  "Medium Onion Rings": "Onion Rings - medium",
  "Large Onion Rings": "Onion Rings - large",
  "Small Hash Browns": "Hash Browns - small",
  "Medium Hash Browns": "Hash Browns - medium",
  "Large Hash Browns": "Hash Browns - large",
  "HERSHEY'S Sundae Pie": "HERSHEY®'S Sundae Pie",
  "Simply Orange Juice": "Simply Orange Juice® - 11.5 oz.",
};

export function categorize(itemName: string): string {
  const t = itemName.toLowerCase();
  if (/whopper|sandwich|cheeseburger|hamburger|chicken fries|chicken jr/.test(t)) return "sandwiches";
  if (/fries|onion rings|hash browns|have-sies/.test(t)) return "sides";
  if (/croissan|french toast|breakfast/.test(t)) return "breakfast";
  if (/pie|shake|cookies|sundae|applesauce/.test(t)) return "desserts";
  return "drinks";
}

export function toNormalizedItems(
  nutrition: BkNutritionRow[],
  estimates: DtiEstimate[],
  ctx: { zip: string; fetchedAt: Date },
): { items: NormalizedItem[]; unmatchedPriced: string[] } {
  const items: NormalizedItem[] = [];
  const unmatchedPriced: string[] = [];
  for (const est of estimates) {
    const short = est.itemName.replace(BK_PREFIX, "");
    const pdfName = ALIASES[short];
    const row = pdfName ? nutrition.find((n) => n.name === pdfName) : undefined;
    if (!row) { unmatchedPriced.push(est.itemName); continue; } // no honest nutrition -> no row
    items.push({
      restaurantSlug: "burger-king",
      productId: est.slug,
      name: est.itemName,
      description: null,
      category: categorize(est.itemName),
      calories: row.calories,
      proteinG: row.proteinG,
      nutritionSourceUrl: "https://bk-use1-prod.sites.rbictg.com/nutrition/nutrition.pdf",
      nutritionConfidence: "medium", // Nov 2022 PDF, BK's currently published version
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
