export type Confidence = "high" | "medium" | "low";
export type PricingType = "exact_store" | "zip_local" | "regional" | "national_estimate";

export interface NormalizedItem {
  restaurantSlug: string; productId: string; name: string; description?: string | null; category: string;
  /** Single official calorie count, or null when unknown or only a range exists. */
  calories: number | null;
  /** Official calorie range (customizable items: "1430-1710"). Both or neither. Never collapsed into a fake single number. */
  caloriesMin?: number | null; caloriesMax?: number | null;
  proteinG: number | null;
  /** Official product image URL from the chain's own feed, when present. */
  imageUrl?: string | null;
  nutritionSourceUrl: string; nutritionConfidence: Confidence;
  price: number; pricingType: PricingType; priceSourceUrl: string; storeId: string; zip: string;
  fetchedAt: string; // ISO
}

export interface RestaurantAdapter {
  slug: string;
  fetchMenu(location: { storeId: string }): Promise<unknown>;
  normalizeItems(raw: unknown, ctx: { storeId: string; zip: string; fetchedAt: Date; sourceUrl: string }): NormalizedItem[];
}
