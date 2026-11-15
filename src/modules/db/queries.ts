import officialImages from "../../../data/official-images.json";
import { sql } from "drizzle-orm";
import type { Db } from "./client";

/** Latest price + latest nutrition per item, with restaurant identity, for a ZIP. */
export interface RankableRow {
  restaurantSlug: string;
  restaurantName: string;
  productId: string;
  name: string;
  category: string | null;
  price: number;
  pricingType: string;
  calories: number | null;
  caloriesMin: number | null;
  caloriesMax: number | null;
  proteinG: number | null;
  imageUrl: string | null;
  priceSourceUrl: string;
  nutritionSourceUrl: string | null;
  fetchedAt: string;
}

export async function rankableRows(db: Db, zip: string): Promise<RankableRow[]> {
  const res = await db.execute(sql`
    SELECT r.slug AS restaurant_slug, r.name AS restaurant_name,
           m.restaurant_product_id AS product_id, m.name, m.category, m.image_url AS image_url,
           p.price::float AS price, p.pricing_type, p.source_url AS price_source_url,
           p.fetched_at AS fetched_at,
           n.calories::float AS calories, n.calories_min::float AS calories_min, n.calories_max::float AS calories_max,
           n.protein_g::float AS protein_g,
           n.source_url AS nutrition_source_url
    FROM menu_items m
    JOIN restaurants r ON r.id = m.restaurant_id
    JOIN LATERAL (
      SELECT * FROM price_records p WHERE p.menu_item_id = m.id AND (p.zip = ${zip} OR p.zip IS NULL)
      ORDER BY p.fetched_at DESC LIMIT 1
    ) p ON true
    LEFT JOIN LATERAL (
      SELECT * FROM nutrition_records n WHERE n.menu_item_id = m.id
      ORDER BY n.retrieved_at DESC LIMIT 1
    ) n ON true
    WHERE m.active
  `);
  return (res.rows as any[]).map((r) => ({
    restaurantSlug: r.restaurant_slug,
    restaurantName: r.restaurant_name,
    productId: r.product_id,
    name: r.name,
    category: r.category,
    price: r.price,
    pricingType: r.pricing_type,
    calories: r.calories,
    caloriesMin: r.calories_min,
    caloriesMax: r.calories_max,
    proteinG: r.protein_g,
    imageUrl: r.image_url ?? (officialImages as Record<string, { imageUrl: string }>)[`${r.restaurant_slug}:${r.product_id}`]?.imageUrl ?? null,
    priceSourceUrl: r.price_source_url,
    nutritionSourceUrl: r.nutrition_source_url,
    fetchedAt: r.fetched_at,
  }));
}

export interface DealRow {
  restaurantName: string;
  title: string;
  price: number | null;
  promoCode: string | null;
  expiresAt: string | null;
  lastVerified: string;
  sourceUrl: string;
  appOnly: boolean;
  /** Redemption channel label: "app" | "online" | null (null = ordinary coupon). */
  redemption: string | null;
}

export async function activeDeals(db: Db): Promise<DealRow[]> {
  const res = await db.execute(sql`
    SELECT r.name AS restaurant_name, d.title, d.price::float AS price, d.promo_code,
           d.expires_at, d.last_verified, d.source_url, d.app_only, d.redemption
    FROM deals d JOIN restaurants r ON r.id = d.restaurant_id
    WHERE d.active AND (d.expires_at IS NULL OR d.expires_at > now())
    ORDER BY d.expires_at ASC NULLS LAST
  `);
  return (res.rows as any[]).map((r) => ({
    restaurantName: r.restaurant_name,
    title: r.title,
    price: r.price,
    promoCode: r.promo_code,
    expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    lastVerified: new Date(r.last_verified).toISOString(),
    sourceUrl: r.source_url,
    appOnly: Boolean(r.app_only),
    redemption: r.redemption ?? null,
  }));
}
