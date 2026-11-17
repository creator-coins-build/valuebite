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

## Wendy's - EXCLUDED (no honest data path)
No US nutrition PDF exists (only UK), wendys.com/nutrition-allergens is informational-only, and per-item nutrition sits behind the auth-gated, Turnstile-protected ordering app (order.wendys.com, api.app.prd.wendys.digital). Browser attempt 2026-11-15: store search requires Google Places autocomplete and doesn't yield a one-time extraction cleanly. Left out rather than guessed. Revisit if Wendy's publishes a nutrition feed/PDF.

## Digital offers (2026-11-15)

Home now leads with digital offers. App-only is a strict channel claim, never
inferred from membership, "mobile", or "exclusive" wording. Taco Bell's member
and online categories are both labeled App + online because the official
online-exclusives page explicitly supports either channel.

`data/digital-offers.json` holds manually reviewed offers, exact source excerpts,
terms, account eligibility and per-offer check times. These offers hide after
48 hours without another actual source review. Refreshing menu prices or
exporting a snapshot does NOT renew their review timestamp. Account/local
availability is not guaranteed. BK's Walmart+ offers explicitly require an
existing paid Walmart+ membership linked to Royal Perks; ValueBite does not
sign anyone up or claim a benefit. Chipotle's signup reward has a $5 minimum,
is once-only, and expires seven days after being added to an eligible account.

Reviewed official pages:
- https://www.tacobell.com/food/online-exclusives
- https://www.tacobell.com/rewards
- https://campaign.bk.com/royal-perks
- https://campaign.bk.com/partnerships/walmart-faqs
- https://www.chipotle.com/rewards
- https://www.chipotle.com/free-chips-guac
- https://www.chick-fil-a.com/customer-support/events-and-promotions/receipt-survey/how-can-i-get-free-chick-fil-a-food
- https://www.chick-fil-a.com/officialrules

No live Chick-fil-A local/account offer is confirmed for ZIP 33613. No current
true app-only deal is confirmed in this release. Old Domino's Emergency Pizza
campaigns with past end dates are excluded. Existing Domino's coupons remain
sourced from its official store ordering API. Source extracts are in
`docs/research/`; they are evidence, never execution instructions.

Seven Chick-fil-A image matches come from
https://www.chick-fil-a.com/menu/entrees with provenance in
`data/official-images.json`. Plain sandwich and wrap names match exactly;
8-count nuggets and 3-count strips are limited to the count stated in the
chain's own image filename. Cheese variants are not given a default picture.

Burger King photo expansion: its official www.bk.com JavaScript menu references
Sanity project kjfd81ul, dataset prod_bk_us. The unauthenticated public item
query returns item names and dereferenced image URLs. All 19 existing BK rows
now have exact name matches after removing only the chain prefix, trademark
symbols, letter case and extra whitespace. We did not collapse bacon, cheese,
double, portion size or other meaningful food differences. Where multiple
records share the same exact name, use the most recently updated record.
The selected source IDs, source update times and query URL are preserved in
`data/official-images.json` and `docs/research/bk-photos-2026-11-15.json`.
Images use only this project's official asset path, not arbitrary Sanity images.

## Photo coverage ceiling (2026-11-15)

- Taco Bell: official per-item photos from the store menu feed (all rows with feed images).
- Burger King: 19/19 rows via exact-name match to BK's official Sanity menu images.
- Chick-fil-A: 7 rows. The official menu pages publish one card per base item
  (e.g. "Cobb Salad", "8 ct Nuggets"); our rows are cheese/count/protein
  variants the site does not photograph separately. No further honest matches
  exist on the current site.
- Chipotle: no photos. Our rows are composite builds ("Chicken Bowl");
  chipotle.com publishes no per-build photos (public menu page 404s; ordering
  API requires a subscription key - not bypassed). Icon fallback remains.
- Domino's: unchanged (no official item photos harvested yet).

## Papa John's (2026-11-15): exact per-store prices + deals via the site's own public tRPC API

The public ordering site (www.papajohns.com, no login, no challenge) is a
Next.js app that calls same-origin tRPC endpoints. These are the exact calls
its own menu, store-search and deals pages make, observed in a real browser
session (see data/papajohns/33613.json):

- POST /api/trpc/stores.searchStores  {"json":{"postalCode":"33613","searchType":"CARRYOUT"}}
  -> nearest stores: storeId, address, distance
- GET  /api/trpc/product.getByStore   {"json":{"storeId":920}}
  -> full menu (~196 products): name, sku, displayPrice (store-exact),
     calories + servingLabel, official image path
- GET  /api/trpc/deals.getByStore     {"json":{"storeId":920,"isDesktop":true}}
  -> live store deals (~15): title, offerCode, displayPrice/regularMenuPrice

Store-exact pricing captured for store 920 at 14861 North Dale Mabry
Highway, Tampa, FL. Only ZIP 33613 is supported in this snapshot.
Rows and deals fail closed after 48 hours without another browser review.

Constraints, honored:
- Akamai's edge refuses non-browser clients (plain curl with full browser
  headers gets an edge rejection). NO workaround is attempted: snapshots are
  captured through a normal browser session during the
  refresh only, one snapshot per ZIP, committed to data/papajohns/<zip>.json.
- A ZIP without a committed snapshot shows NO Papa John's rows (never another
  store's prices under its name); the attribution line says exactly which
  store + sample date the prices came from.
- Nutrition units: feed calories are PER SLICE for pizzas with servingLabel
  "/slice, N slices"; whole-item calories = calories x N. Other per-portion labels use their explicit piece counts. Blank units
  are accepted only for individually named sandwiches; ambiguous units stay unknown. Protein is not in the feed -> PJ rows stay out of the
  protein-based Value Score ranking (unknown stays unknown).
- Product images hotlink fine from real browsers, but the server-side image
  proxy cannot fetch them (same edge), so PJ image URLs bypass /api/img
  (DIRECT_HOSTS in src/components/brand.tsx).
- Papa John's app (official, seller Papa John's International Inc.):
  https://apps.apple.com/us/app/papa-johns-pizza-delivery/id407517450

### Browser snapshot refresh

Use the ordinary official carryout flow at https://www.papajohns.com/order/carryout,
search 33613 and confirm store 920's address. From that public menu session,
read the three menuCategory/product/deals responses above. Map every category's
sections/productGroups/productSkus to its categoryId, preserving full product
names, SKUs, displayPrice, calories, servingLabel, description and image.
Store the response capture time, ZIP, store ID and displayed address alongside
products and deals in data/papajohns/33613.json. Do not change fetchedAt without
actually reviewing the live source. A failed source review must not renew data.
New ZIPs need their own locator result, address confirmation and dated capture.
Never export session cookies or retry the refused non-browser route.

## Pizza Hut (2026-11-15): exact per-store prices + nutrition + meal deals via the site's public storefront GraphQL

The public ordering site (www.pizzahut.com, no sign-in) calls the Yum! Brands
storefront GraphQL API with an anonymous guest token the site mints for every
visitor (POST /api/create-yum-guest-token, stored in the Yum_token cookie;
used only inside the browser session, never exported):

- POST https://api.prod.ph-us.yumconnect.dev/ph_us/storefront/graphql
  - GetCategoryByCode(storeNumber, channel:"WEB", categoryCode) -> every item's
    variants with exact price {amount cents} and nutritionInformation entries
    (calories / servings / unit, e.g. 176 cal x 8 slices for a Large
    Hand-Tossed Pepperoni at $17.49)
  - GetBundlesByCode(storeNumber, channel:"WEB") -> ~67 priced meal deals
    (bundle codes are internal identifiers, NOT customer promo codes)

Store chosen through the normal public carryout flow: search 33613, pick from
the site's own list -> store 038698 = 2550 E. Fowler Ave., Tampa.

Same rules as Papa John's: browser-session capture only during refresh, one
committed snapshot per ZIP (data/pizzahut/33613.json), exact rows only for
covered ZIPs with the store + sample date shown, rows/deals fail closed after
48h without an actual re-review, no workarounds for non-browser access.
Whole-item calories = composite per-unit calories x official unit count,
where composite = variant base + default modifiers' nutrition (verified
against the site's own display 2026-11-15, see
docs/research/ph-nutrition-units-2026-11-15.md); variants missing either
number keep calories unknown. No protein published -> PH rows
stay out of the Value Score ranking. This API carries no product images, so
PH rows show the brand icon.
- Pizza Hut app (official, seller Pizza Hut, Inc.):
  https://apps.apple.com/us/app/pizza-hut-delivery-takeout/id321560858

## Scouting leads (not yet captured)
- Sonic (recon 2026-11-15 PM): capture path = UI-driving, NOT API replay. Item pages are public and rendered with name/description/calories (e.g. /menu/categories/limited-time/value/7-big-deal-meal/ shows 940 cal). Prices/deals require store selection via the "Select A Store" UI (page shows "Find a store for pricing" until then). Backend api-idp.sonicdrivein.com (/menu/0, /snc/digital-exp-api/v1/locations?latitude&longitude) is worker-gated (requires app-issued x-channel/location/hostname context) and sits behind PerimeterX; do not hand-replay. Store lookup by lat/lon is callable. Next: dedicated capture run - drive Select A Store with 33613/33543, read rendered prices per category, same method as PH/PJ.
- DQ: undetermined. Jack in the Box: not started.
- Hard stops (no-bypass rule): McDonald's/KFC 403, Popeyes WAF, Wendy's auth+Turnstile, Panda Express 403.

### Sonic capture status (2026-11-15 evening)
- data/sonic/33613.json: 201 unique items, store 1915 E Fowler Ave Tampa (nearest 33613), captured via public store-picker UI + rendered category pages. 124 items have exact store prices+calories; 77 items (breakfast, chicken, extra-sauces, hot-dogs, sandwiches, sweets, tea-coffee, wacky-pack, most other-drinks) have name+category only, price/cal unknown.
- GOTCHA: Sonic store selection is ephemeral - it survives only a handful of client-side navigations, then prices silently vanish ("View Item" replaces price/Add To Bag). Full page reloads always drop it. Capture in batches of ~4-5 categories, re-select store between batches, and verify EVERY extracted card has $ (checking only the first card is not enough).
- Store select flow that works: Order Pickup button -> searchbox type ZIP -> click "Tampa, FL" suggestion -> first "Order Here".
- TODO next run: re-capture the 8 unpriced categories for 33613; full capture for 33543 (store 1908 Bruce B. Downs Blvd, Wesley Chapel); build sonic adapter + wire coverage; item-level size variants not captured (cards show default size only).

### Sonic capture update (2026-11-15 ~7 PM ET)
- Re-captured sweets (23) and breakfast (14) WITH prices. Final 33613 snapshot: 201 items, 138 with exact prices, all 201 with official calories.
- The 63 unpriced items (tea-coffee, other-drinks, hot-dogs, chicken, extra-sauces, wacky-pack, sandwiches) consistently render as "View Item" with NO price on the official site at store 1915 E Fowler Ave even while every other category on the same page shows prices - treated as genuinely not orderable at capture time, price stays unknown (matches the site's own display). OPEN QUESTION: verify at a different time of day whether these become priced (possible daypart/availability gating).
- Store session reliably dies after ~1-2 category navigations; extract immediately and verify category-prefixed cards (not just any card) carry $ before extracting.

### Per-chain live-API feasibility recon (2026-11-15 ~8:30 PM ET)
Goal: which snapshot chains can become live per-ZIP server-side adapters (TB/Domino's model) vs staying browser-capture snapshots. Method: observe the endpoints the public sites themselves call (cloud browser performance entries), then test plain datacenter curl reachability WITHOUT cookies/tokens (no bypass).

- Papa John's: site calls public tRPC endpoints (/api/trpc/stores.searchStores, stores.getStoreById, product.getByStore, menuCategory.getByStore?input={"json":{"storeId":920}}). www.papajohns.com is Akamai-walled from datacenter IPs: GET returns edge "Invalid URL" 400, POST "Access Denied". VERDICT: not server-side reachable; stays browser-capture snapshot (current model). Endpoint map above is useful for browser-driven capture.
- Pizza Hut: two API layers. (1) services.digital.pizzahut.com/phdapi/v2/stores/{id}?key=... IS reachable via plain curl (store info only; no menu endpoints - /menu paths 404). (2) Menu data comes from api.prod.ph-us.yumconnect.dev/ph_us/storefront/graphql (reachable, responds 200 to unauthenticated trivial query) using query GetCategoryByCode(storeNumber, channel=WEB, categoryCode, includeSubcategories) with fragments incl. variants.price and nutritionInformation + defaultModifiers nutrition (matches the verified composite rule). BUT real queries return 401 without a guest token, and the token endpoint (www.pizzahut.com/api/create-yum-guest-token) is on the walled host (connection refused from datacenter). VERDICT: menu not server-side reachable without replaying browser-issued tokens (not allowed); stays browser-capture snapshot.
- Sonic: unchanged - api-idp.sonicdrivein.com is worker-gated behind PerimeterX; stays UI-driven capture.
- Net: TB + Domino's remain the only live per-ZIP server-side adapters. Free-route scaling for PJ/PH/Sonic = scheduled browser-driven snapshot capture extended to more stores/ZIPs, using the endpoint/query intel above to keep captures efficient and honest.

## Sonic - PAUSED (2026-11-17)

Sonic capture is paused per product-owner decision. On 2026-11-17 a fresh 33613
capture reached 16/18 categories, then store sessions began dropping instantly and
navigation redirected to wrong categories - treated as suspected soft-throttling and
stopped per the no-workarounds rule. Decision: let existing snapshots lapse and hide
at expiry; no retries (new session or timer alone does not justify retrying). Resume
only with a genuinely new signal or a verified authorized alternative. Partial raw
batch preserved at data/sonic/raw/refresh-33613-2026-11-17/ (not assembled).
