# Pizza Hut nutrition units - RESOLVED (2026-11-15)

Question (from Main): verify the feed's serving definition before relying on
PH calories in comparisons.

Finding: the GraphQL variant nutritionInformation is the BASE ONLY (crust for
pizzas). The site displays a COMPOSITE: variant base + every default modifier's
own nutritionInformation (sauce, cheese, crust finishers, toppings).

Verified composition, per slice, store 038716 + 038698, 2026-11-15:
  displayed cal/slice = variant base + sum(default modifier calories x weight)
  - Large Hand-Tossed Pepperoni: 176 + marinara 10 + cheese 80 + pepperoni 50
    + garlic-parm 7 = 323 = site display "323 cal/slice, 8 slices" (exact)
  - Pepperoni Lover's 393, Supreme 478, Meat Lover's 623, Cheese 273 - all exact
    matches to the site's own menu cards.
  - Third-party PH nutrition references (~320/slice large pepperoni) agree.
Whole-item = composite per-slice x servings (8 for a large).

Evidence trail: raw variant entries captured in-session
(["name:","calories:176","servings:8","unit:slice","units:slices","portion:0"]),
modifier entries (e.g. Pepperoni "calories:50","units:Slice"), and the site's
own rendered menu text ("323 cal/slice, 8 slices").

Action taken: both snapshots (33613 store 038698, 33543 store 038716)
re-captured with composite per-unit calories; adapter wholeCalories = cal x
serv restored. Base-only capture (which understated calories ~1.8x) retired;
capture scripts must include defaultModifiers nutrition from now on.
