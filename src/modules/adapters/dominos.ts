import type { NormalizedItem, RestaurantAdapter } from "./types";

/**
 * Domino's adapter.
 *
 * Source: order.dominos.com (official ordering site, public JSON, no login).
 *   Store locator: /power/store-locator?c={zip}&type=Carryout
 *   Store menu:    /power/store/{storeId}/menu?lang=en&structured=true
 *
 * The menu feed carries exact per-store prices on Variants and official
 * coupons in Coupons (keyed by the code you enter online), with EffectiveOn /
 * ExpiresOn dates. This is the promo-code source: only codes from this feed,
 * labeled "listed by official source, checked <time>" - never "verified
 * working", and never from coupon sites (Dylan's promo rule, 2026-11-13).
 *
 * Nutrition: Domino's publishes none in this feed and no public source was
 * found, so calories and protein are null (unknown, never guessed).
 */

export interface NormalizedCoupon {
  code: string;
  name: string;
  /** Fixed deal price when the coupon is a priced bundle (e.g. 8.99); null for %-off style. */
  price: number | null;
  effectiveOn: string | null;
  expiresOn: string | null;
  serviceMethods: string[];
  bundle: boolean;
  local: boolean;
  sourceUrl: string;
  /** ISO timestamp of when we read the official feed. */
  lastChecked: string;
}

const BASE = "https://order.dominos.com/power";
const NUM = /^\d+(\.\d+)?$/;

export const DominosAdapter: RestaurantAdapter = {
  slug: "dominos",
  async fetchMenu({ storeId }) {
    const res = await fetch(`${BASE}/store/${encodeURIComponent(storeId)}/menu?lang=en&structured=true`, {
      headers: { "user-agent": "ValueBiteBot/0.1 (+contact owner)" },
    });
    if (!res.ok) throw new Error(`dominos menu ${res.status}`);
    return res.json();
  },

  normalizeItems(raw: any, ctx) {
    const out: NormalizedItem[] = [];
    const variants: Record<string, any> = raw?.Variants ?? {};
    for (const [pcode, p] of Object.entries<any>(raw?.Products ?? {})) {
      for (const vcode of p?.Variants ?? []) {
        const v = variants[vcode];
        if (!v) continue;
        out.push({
          restaurantSlug: "dominos",
          productId: String(vcode),
          name: String(v.Name ?? p.Name ?? vcode),
          description: p.Description ?? null,
          category: String(p.ProductType ?? "other"),
          calories: null, // no official nutrition feed found - unknown stays unknown
          proteinG: null,
          nutritionSourceUrl: ctx.sourceUrl,
          nutritionConfidence: "low",
          price: NUM.test(String(v.Price ?? "")) ? Number(v.Price) : NaN,
          pricingType: "exact_store",
          priceSourceUrl: ctx.sourceUrl,
          storeId: ctx.storeId,
          zip: ctx.zip,
          fetchedAt: ctx.fetchedAt.toISOString(),
        });
      }
    }
    return out;
  },
};

export function normalizeCoupons(raw: any, ctx: { sourceUrl: string; fetchedAt: Date }): NormalizedCoupon[] {
  const out: NormalizedCoupon[] = [];
  for (const c of Object.values<any>(raw?.Coupons ?? {})) {
    if (!c?.Code) continue;
    out.push({
      code: String(c.Code),
      name: String(c.Name ?? ""),
      price: NUM.test(String(c.PriceInfo?.Value ?? c.Price ?? "")) ? Number(c.PriceInfo?.Value ?? c.Price) : null,
      effectiveOn: c.Tags?.EffectiveOn ?? null,
      expiresOn: c.Tags?.ExpiresOn ?? null,
      serviceMethods: Array.isArray(c.Tags?.ValidServiceMethods) ? c.Tags.ValidServiceMethods.map(String) : [],
      bundle: c.Bundle === true,
      local: c.Local === true,
      sourceUrl: ctx.sourceUrl,
      lastChecked: ctx.fetchedAt.toISOString(),
    });
  }
  return out;
}

export const DominosStoreLocator = {
  url: (zip: string) => `${BASE}/store-locator?c=${encodeURIComponent(zip)}&type=Carryout`,
};
