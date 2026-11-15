# Data source findings (probed 2026-11-12, plain public GETs, no login, no block evasion)

| Chain | Price | Nutrition | Notes |
|---|---|---|---|
| Domino's | Exact per store: GET order.dominos.com/power/store-locator?c=ZIP&type=Carryout, then /power/store/{id}/menu?lang=en&structured=true (e.g. store 3813, 33613; 222 variants) | Not found yet (official page renders client-side) | Menu JSON also lists Coupons with code, price, EffectiveOn |
| Taco Bell | Exact per store: GET www.tacobell.com/tacobellwebservices/v4/tacobell/stores?latitude&longitude, then /products/menu/{store} (store 036133 = 2031 E Bearss Ave, 33613) and /products/{code}/{store} | Calories in the same JSON. Protein not present (links to nutritionix label popups) | Gives exact price + calories, protein unknown |
| Chick-fil-A | No public price source found | Official nutrition page embeds full table (calories, protein) in HTML | Nutrition only |
| Chipotle | Not yet checked | Nutrition calculator page loads | |
| McDonald's, KFC | 403 Access Denied | 403 | Not attempting to bypass |
| Wendy's, BK, Popeyes, Little Caesars, Subway | Unclear/empty responses | not checked | Need follow-up |

## Chick-fil-A prices (Level 4 fallback, added 2026-11-13)
- Chick-fil-A publishes no public price feed. Fallback: Drive Thru Index (drivethruindex.com), a third-party tracker that reads official ordering sites daily across ~3,050 US stores and publishes per-item typical price + range + checked date (JSON-LD Dataset on each item page).
- 60 item pages harvested via scripts/harvest-cfa-prices.ts (2026-11-13, all checked 2026-11-13). 52 matched official nutrition items by slug.
- Stored as pricingType=national_estimate, confidence=low. UI label: "Typical price - may vary". NEVER presented as exact.
- 8 unmatched: 5-ct nuggets, filet/spicy-filet salad variants (DTI tracks items CFA nutrition page structures differently).

## Burger King (Level 4 typical prices + official nutrition PDF)
- Nutrition: official BK USA Nutrition Information PDF (Nov 2022, the version bk.com/nutrition-explorer links): https://bk-use1-prod.sites.rbictg.com/nutrition/nutrition.pdf - fixture tests/fixtures/bk-nutrition.pdf, parsed to data/bk-nutrition.json.
- Prices: Drive Thru Index typical prices (data/burger-king-price-estimates.json via scripts/harvest-dti-prices.ts). Labeled "Typical price - may vary (exact data takes longer)".
- Items whose names the PDF text extraction loses (Croissan'wich rows) and fountain drink sizes (not in PDF) get NO row - never guessed.

## Chipotle (Level 4 typical prices + official per-ingredient nutrition)
- Nutrition: official US Nutrition Facts paper-menu PDF: https://www.chipotle.com/content/dam/chipotle/menu/nutrition/US-Nutrition-Facts-Paper-Menu-3-2025.pdf - parsed to data/chipotle-nutrition.json (per-ingredient cal/protein).
- Entrees (burrito/bowl/salad/tacos) are documented default builds = plain sums of official per-ingredient values (build listed on each item's description). Veggie entrees include guacamole per Chipotle's published definition.
- Items with no official nutrition (Mexican Coke/Sprite, apple juice, kids/family meals) get NO row.
