import { pgTable, text, integer, numeric, boolean, timestamp, doublePrecision, jsonb, uuid, index, uniqueIndex } from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (n: string) => timestamp(n, { withTimezone: true });

export const restaurants = pgTable("restaurants", {
  id: id(), name: text("name").notNull(), slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"), website: text("website"), active: boolean("active").notNull().default(true),
});

export const dataSources = pgTable("data_sources", {
  id: id(), restaurantId: uuid("restaurant_id").references(() => restaurants.id),
  kind: text("kind").notNull(), // official_api | official_site | official_nutrition_doc | public_ordering | manual_verified | other
  priority: integer("priority").notNull(), // 1..6 per spec s21
  url: text("url").notNull(), notes: text("notes"),
});

export const restaurantLocations = pgTable("restaurant_locations", {
  id: id(), restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  storeId: text("store_id"), address: text("address"), lat: doublePrecision("lat"), lon: doublePrecision("lon"),
  zip: text("zip"), city: text("city"), state: text("state"), active: boolean("active").notNull().default(true),
  sourceId: uuid("source_id").references(() => dataSources.id),
}, t => [index("loc_zip_idx").on(t.zip)]);

export const menuItems = pgTable("menu_items", {
  id: id(), restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  restaurantProductId: text("restaurant_product_id"), name: text("name").notNull(), description: text("description"),
  category: text("category"), imageUrl: text("image_url"), servingInfo: text("serving_info"),
  isPreset: boolean("is_preset").notNull().default(false), presetNotes: text("preset_notes"), // s43 labeled builds
  active: boolean("active").notNull().default(true), lastVerified: ts("last_verified"),
}, t => [uniqueIndex("item_product_uq").on(t.restaurantId, t.restaurantProductId)]);

export const nutritionRecords = pgTable("nutrition_records", {
  id: id(), menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  /** calories is the single official count; for customizable items the official range goes in calories_min/max (both set, calories null). */
  calories: numeric("calories"), caloriesMin: numeric("calories_min"), caloriesMax: numeric("calories_max"),
  proteinG: numeric("protein_g"), carbsG: numeric("carbs_g"), fatG: numeric("fat_g"),
  sourceId: uuid("source_id").references(() => dataSources.id), sourceUrl: text("source_url").notNull(),
  retrievedAt: ts("retrieved_at").notNull(), confidence: text("confidence").notNull(), // high | medium | low
});

/** Price is separate from the item (s15). pricingType maps to the fallback levels (s12). */
export const priceRecords = pgTable("price_records", {
  id: id(), menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  locationId: uuid("location_id").references(() => restaurantLocations.id),
  zip: text("zip"), region: text("region"),
  price: numeric("price").notNull(),
  pricingType: text("pricing_type").notNull(), // exact_store | zip_local | regional | national_estimate
  channel: text("channel").notNull().default("pickup"), // pickup | delivery
  sourceId: uuid("source_id").references(() => dataSources.id), sourceUrl: text("source_url").notNull(),
  fetchedAt: ts("fetched_at").notNull(), validUntil: ts("valid_until"), confidence: text("confidence").notNull(),
}, t => [index("price_item_idx").on(t.menuItemId), index("price_zip_idx").on(t.zip)]);

export const deals = pgTable("deals", {
  id: id(), restaurantId: uuid("restaurant_id").notNull().references(() => restaurants.id),
  /** price is null for %-off / non-priced offers (e.g. "20% off your entire order"). */
  title: text("title").notNull(), description: text("description"), price: numeric("price"),
  startsAt: ts("starts_at"), expiresAt: ts("expires_at"), redemption: text("redemption"),
  appOnly: boolean("app_only").default(false), deliveryOnly: boolean("delivery_only").default(false), pickupOnly: boolean("pickup_only").default(false),
  participatingLocations: text("participating_locations"), promoCode: text("promo_code"),
  sourceId: uuid("source_id").references(() => dataSources.id), sourceUrl: text("source_url").notNull(),
  lastVerified: ts("last_verified").notNull(), active: boolean("active").notNull().default(true),
});

export const dealItems = pgTable("deal_items", {
  id: id(), dealId: uuid("deal_id").notNull().references(() => deals.id), menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id),
  quantity: integer("quantity").notNull().default(1), configNote: text("config_note"), // documented default configuration (s17)
});

export const valueScores = pgTable("value_scores", {
  id: id(), version: text("version").notNull(), subjectType: text("subject_type").notNull(), subjectId: uuid("subject_id").notNull(),
  context: text("context").notNull(), valueScore: numeric("value_score"), calPerDollar: numeric("cal_per_dollar"), proteinPerDollar: numeric("protein_per_dollar"),
  inputs: jsonb("inputs").notNull(), computedAt: ts("computed_at").notNull().defaultNow(),
});

export const dataRefreshRuns = pgTable("data_refresh_runs", {
  id: id(), sourceId: uuid("source_id").references(() => dataSources.id), adapter: text("adapter").notNull(), kind: text("kind").notNull(),
  status: text("status").notNull(), // success | failed | quarantined
  startedAt: ts("started_at").notNull(), finishedAt: ts("finished_at"), itemsUpdated: integer("items_updated").default(0),
  anomalies: jsonb("anomalies"), error: text("error"),
});

export const priceHistory = pgTable("price_history", {
  id: id(), menuItemId: uuid("menu_item_id").notNull().references(() => menuItems.id), zip: text("zip"), price: numeric("price").notNull(),
  pricingType: text("pricing_type").notNull(), observedAt: ts("observed_at").notNull(),
});
export const dealHistory = pgTable("deal_history", {
  id: id(), dealId: uuid("deal_id").notNull().references(() => deals.id), snapshot: jsonb("snapshot").notNull(), observedAt: ts("observed_at").notNull(),
});
export const clickEvents = pgTable("click_events", {
  id: id(), itemId: uuid("item_id"), dealId: uuid("deal_id"), restaurantId: uuid("restaurant_id"), source: text("source"),
  sessionId: text("session_id"), destination: text("destination"), at: ts("at").notNull().defaultNow(),
});
