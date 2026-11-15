# Pizza Hut nutrition units - OPEN ISSUE (2026-11-15)

Main asked to verify the feed serving definition before relying on PH calories.
Finding: the live site displays a COMPOSITE per-slice value, the GraphQL
variant nutritionInformation is only the BASE.

Evidence (store 038716, Wesley Chapel, captured in-session 2026-11-15 ~18:31Z):
- GetCategoryByCode variant: "Large Hand-Tossed Pepperoni Pizza" ->
  nutritionInformation: ["name:","calories:176","servings:8","unit:slice","units:slices","portion:0"], price 1749.
- Same store/site menu page displays: "Pepperoni $17.49 ... 323 cal/slice, 8 slices".
- GetProducts response (client-side nav query): defaultModifiers carry their
  OWN nutritionInformation, e.g. Pepperoni topping "calories:40","units:Slice";
  Pork 50, Bacon 30. So displayed 323/slice = base + default modifiers
  (176 + 40 + ... exact composition TBD next run: find where 323 is composed -
  check base cheese variant value, crust slot modifier, size-specific values).
- Third-party references (fastfoodnutrition.org, PH-cited calculators) put a
  large hand-tossed pepperoni slice at ~310-320 cal, consistent with 323, NOT 176.

Impact: current data/pizzahut/33613.json (live) understates whole-item calories
(176x8=1408 vs site-displayed 323x8=2584). Adapter wholeCalories = cal x serv is
arithmetically fine but cal is the wrong input. PH rows are Unscored (no protein)
so rankings are unaffected; displayed calories are understated.

Next run:
1. In a PH session, find the exact composition of the displayed 323 (GetProducts
   response fields: variant base + slot_pizza_crust/size + toppings modifiers).
2. Fix the pizzahut adapter/snapshot to use composite per-slice calories that
   match the site's own display; regenerate 33613 + 33543 snapshots.
3. Then finish PH 33543 capture: store 038716 (28670 FL-54, Wesley Chapel,
   storeNumber cookie confirmed). Capture script from 33613 run is in the
   transcript at 2026-11-15 13:13 EST (search chat_events for GetCategoryByCode).
