import type { NormalizedItem, RestaurantAdapter } from "./types";

const BASE = "https://www.tacobell.com/tacobellwebservices/v4/tacobell";
const NUM = /^\d+(\.\d+)?$/;
const RANGE = /^(\d+)-(\d+)$/;

/**
 * Taco Bell's own site JSON: exact per-store price + calories.
 * Protein is NOT in this feed, so it is null (unknown), never guessed.
 * Calorie ranges ("670-2050", customizable combos) are skipped: no single honest number.
 */
export const TacoBellAdapter: RestaurantAdapter = {
  slug: "taco-bell",
  async fetchMenu({ storeId }) {
    const res = await fetch(`${BASE}/products/menu/${encodeURIComponent(storeId)}`, { headers: { "user-agent": "ValueBiteBot/0.1 (+contact owner)" } });
    if (!res.ok) throw new Error(`taco bell menu ${res.status}`);
    return res.json();
  },
  normalizeItems(raw: any, ctx) {
    const out: NormalizedItem[] = [];
    for (const cat of raw?.menuProductCategories ?? []) {
      for (const p of cat.products ?? []) {
        const cal = String(p.calories ?? "");
        const price = p.price?.value;
        const range = RANGE.exec(cal);
        const imgs: any[] = Array.isArray(p.images) ? p.images : [];
        const img = (f: string) => imgs.find(i => i.imageType === "PRIMARY" && i.format === f)?.url;
        const imageUrl = img("269x269") ?? img("750x340") ?? (typeof p.productImageUrl === "string" && p.productImageUrl ? p.productImageUrl : null);
        out.push({
          restaurantSlug: "taco-bell", productId: String(p.code), name: String(p.name), description: p.description ?? null,
          category: String(p.primaryCategoryCode ?? cat.code),
          calories: NUM.test(cal) ? Number(cal) : null,
          // official range (e.g. combos where drink/side choices vary) - kept as a range, never collapsed
          caloriesMin: range ? Number(range[1]) : null,
          caloriesMax: range ? Number(range[2]) : null,
          proteinG: null, imageUrl,
          nutritionSourceUrl: ctx.sourceUrl, nutritionConfidence: "high",
          price: typeof price === "number" ? price : NaN, pricingType: "exact_store",
          priceSourceUrl: ctx.sourceUrl, storeId: ctx.storeId, zip: ctx.zip, fetchedAt: ctx.fetchedAt.toISOString(),
        });
        if (p.isAvailableInStore === false) out.pop();
      }
    }
    // same product appears in several categories: keep first occurrence, report nothing silently dropped elsewhere
    const seen = new Set<string>();
    return out.filter(i => (seen.has(i.productId) ? false : (seen.add(i.productId), true)));
  },
};

export interface TbExclusive {
  productId: string; name: string; price: number | null;
  /** Member-exclusive does not mean app-only. Both current categories are digital offers. */
  kind: "app" | "online";
}

/**
 * Taco Bell's own menu JSON marks app/online-only products in two dedicated
 * categories ("Member exclusive", "Online exclusives") - an official source
 * for digital-exclusive offers, refreshed with the menu.
 */
export function exclusiveDeals(raw: any): TbExclusive[] {
  const out: TbExclusive[] = [];
  for (const cat of raw?.menuProductCategories ?? []) {
    const kind = ["member-exclusive", "online-exclusives"].includes(cat?.code) ? "online" as const : null;
    if (!kind) continue;
    for (const p of cat.products ?? []) {
      if (p.isAvailableInStore === false) continue;
      out.push({
        productId: String(p.code),
        name: String(p.name),
        price: typeof p.price?.value === "number" ? p.price.value : null,
        kind,
      });
    }
  }
  return out;
}
