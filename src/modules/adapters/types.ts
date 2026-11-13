export type Confidence = "high" | "medium" | "low";
export type PricingType = "exact_store" | "zip_local" | "regional" | "national_estimate";

export interface NormalizedItem {
  restaurantSlug: string; productId: string; name: string; description?: string | null; category: string;
  calories: number | null; proteinG: number | null;
  nutritionSourceUrl: string; nutritionConfidence: Confidence;
  price: number; pricingType: PricingType; priceSourceUrl: string; storeId: string; zip: string;
  fetchedAt: string; // ISO
}

export interface RestaurantAdapter {
  slug: string;
  fetchMenu(location: { storeId: string }): Promise<unknown>;
  normalizeItems(raw: unknown, ctx: { storeId: string; zip: string; fetchedAt: Date; sourceUrl: string }): NormalizedItem[];
}
