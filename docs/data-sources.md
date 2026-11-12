# Data source findings (probed 2026-11-12, plain public GETs, no login, no block evasion)

| Chain | Price | Nutrition | Notes |
|---|---|---|---|
| Domino's | Exact per store: GET order.dominos.com/power/store-locator?c=ZIP&type=Carryout, then /power/store/{id}/menu?lang=en&structured=true (e.g. store 3813, 33613; 222 variants) | Not found yet (official page renders client-side) | Menu JSON also lists Coupons with code, price, EffectiveOn |
| Taco Bell | Exact per store: GET www.tacobell.com/tacobellwebservices/v4/tacobell/stores?latitude&longitude, then /products/menu/{store} (store 036133 = 2031 E Bearss Ave, 33613) and /products/{code}/{store} | Calories in the same JSON. Protein not present (links to nutritionix label popups) | Gives exact price + calories, protein unknown |
| Chick-fil-A | No public price source found | Official nutrition page embeds full table (calories, protein) in HTML | Nutrition only |
| Chipotle | Not yet checked | Nutrition calculator page loads | |
| McDonald's, KFC | 403 Access Denied | 403 | Not attempting to bypass |
| Wendy's, BK, Popeyes, Little Caesars, Subway | Unclear/empty responses | not checked | Need follow-up |
