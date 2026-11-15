import type { NormalizedItem } from "./types";
import type { DtiEstimate } from "./bk-prices";

/**
 * Chipotle: official per-ingredient nutrition (US-Nutrition-Facts-Paper-Menu
 * PDF, chipotle.com) composed into DTI-priced entrees using a documented
 * default build per format, plus direct side items. Prices are Drive Thru
 * Index typical prices (Level 4 national_estimate, labeled, never exact).
 *
 * Composed nutrition = plain sum of official per-ingredient values for the
 * documented build (listed in each item's description). nutritionConfidence
 * "medium" because builds are customizable. Items with no official nutrition
 * (Mexican Coke/Sprite, apple juice, kids/family meals) get NO row.
 */

export interface ChipotleIngredient { name: string; serving: string; calories: number; proteinG: number; }

/** Default builds, per Chipotle's published serving sizes. */
const PROTEIN = (p: string) => [p, "Cilantro-LimeWhiteRice", "BlackBeans", "FajitaVegetables", "FreshTomatoSalsa", "Cheese", "RomaineLettuce(tacos)"];
const BUILDS: Record<string, (protein: string) => string[]> = {
  Burrito: (p) => ["FlourTortilla(burrito)", ...PROTEIN(p)],
  Bowl: (p) => PROTEIN(p),
  Salad: (p) => ["SupergreensSaladMix", "BlackBeans", p, "FreshTomatoSalsa", "Chipotle-HoneyVinaigrette"],
  "Tacos (3)": (p) => ["CrispyCornTortilla", "CrispyCornTortilla", "CrispyCornTortilla", p, "FreshTomatoSalsa", "Cheese", "RomaineLettuce(tacos)"],
  Taco: (p) => ["CrispyCornTortilla", p, "FreshTomatoSalsa", "Cheese", "RomaineLettuce(tacos)"],
};
/** DTI protein segment -> PDF ingredient name. Veggie entrees include guacamole per Chipotle. */
const PROTEINS: Record<string, string[]> = {
  Chicken: ["Chicken"], Steak: ["Steak"], Carnitas: ["Carnitas"],
  "Beef Barbacoa": ["Barbacoa"], Sofritas: ["Sofritas"], Veggie: ["Guacamole(topping/side)"],
};

/** Direct side items: DTI segment -> [PDF ingredient, multiplier]. */
const SIDES: Record<string, [string, number]> = {
  "Side of Guacamole": ["Guacamole(topping/side)", 1],
  "Large Side of Guacamole": ["Guacamole(large)", 1],
  "Side of Queso Blanco": ["QuesoBlanco(side)", 1],
  "Large Side of Queso Blanco": ["QuesoBlanco(large)", 1],
  "Large Fresh Tomato Salsa": ["FreshTomatoSalsa", 2],
  "Large Roasted Chili-Corn Salsa": ["RoastedChili-CornSalsa", 2],
  "Large Tomatillo-Green Chili Salsa": ["Tomatillo-GreenChiliSalsa", 2],
  "Large Tomatillo-Red Chili Salsa": ["Tomatillo-RedChiliSalsa", 2],
  "Chips": ["Chips(regular)", 1],
};

const CP_PREFIX = /^Chipotle /;

export function toNormalizedItems(
  ingredients: ChipotleIngredient[],
  estimates: DtiEstimate[],
  ctx: { zip: string; fetchedAt: Date },
): { items: NormalizedItem[]; unmatchedPriced: string[] } {
  const byName = new Map(ingredients.map((i) => [i.name, i]));
  const items: NormalizedItem[] = [];
  const unmatchedPriced: string[] = [];
  const push = (est: DtiEstimate, parts: [ChipotleIngredient, number][], build: string, category: string) => {
    const calories = parts.reduce((s, [i, m]) => s + i.calories * m, 0);
    const proteinG = Math.round(parts.reduce((s, [i, m]) => s + i.proteinG * m, 0) * 10) / 10;
    items.push({
      restaurantSlug: "chipotle",
      productId: est.slug,
      name: est.itemName,
      description: `Nutrition computed from official per-ingredient values. Build: ${build}.`,
      category,
      calories,
      proteinG,
      nutritionSourceUrl: "https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf",
      nutritionConfidence: "medium",
      price: est.typical,
      pricingType: "national_estimate",
      priceSourceUrl: est.sourceUrl,
      storeId: "",
      zip: ctx.zip,
      fetchedAt: ctx.fetchedAt.toISOString(),
    });
  };
  for (const est of estimates) {
    const short = est.itemName.replace(CP_PREFIX, "");
    const side = SIDES[short];
    if (side) {
      const ing = byName.get(side[0]);
      if (ing) push(est, [[ing, side[1]]], `${side[1]}x ${side[0]}`, "sides");
      else unmatchedPriced.push(est.itemName);
      continue;
    }
    let matched = false;
    for (const [fmt, build] of Object.entries(BUILDS)) {
      if (!short.endsWith(fmt)) continue;
      const proteinSeg = short.slice(0, short.length - fmt.length).trim();
      const protein = PROTEINS[proteinSeg];
      if (!protein) break;
      const names = [...build(protein[0]!), ...(proteinSeg === "Veggie" && fmt !== "Salad" && fmt !== "Bowl" && fmt !== "Burrito" ? [] : [])];
      const parts: [ChipotleIngredient, number][] = [];
      let ok = true;
      for (const n of names) {
        const ing = byName.get(n);
        if (!ing) { ok = false; break; }
        parts.push([ing, 1]);
      }
      if (ok) { push(est, parts, names.join(" + "), fmt === "Salad" ? "salads" : fmt.startsWith("Taco") ? "tacos" : "entree"); matched = true; }
      break;
    }
    if (!matched && !side) unmatchedPriced.push(est.itemName);
  }
  return { items, unmatchedPriced };
}
