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

## Per-category verification (2026-11-15, store 038698, composite vs the site's own menu cards)

Exact matches per category (composite = variant base + default modifiers):
- pizza: 5 (Pepperoni 323, Pepperoni Lover's 393, Supreme 478, Meat Lover's 623, Cheese 273 per slice)
- wings: 2 (8pc Honey BBQ Boneless 100/wing, 6pc Honey BBQ Traditional 107/wing)
- melts: 3 (Chicken Bacon Parmesan 1310, Meat Lover's 1460, Pepperoni Lover's 1200 per melt)
- sides: 5 (Bacon Cheddar Sticks 150/stick, Roasted Garlic + plain Cheese Sticks 100/stick, Breadsticks 140/stick, Straight-Cut Fries 497/order)
- pasta: 3 (Chicken Alfredo 920, Italian Meats 850, Cheesy Alfredo 880 per pan; bundled breadsticks listed separately by the site and correctly NOT folded in)
- sweets: 5 (Brownie 230/serving, Cinnabon Mini Rolls 80/roll, Cinnamon Sticks 80/stick, Cookie 190/serving, Apple Pies 172/pie)
- drinks: 6 (Dr Pepper 250, Mtn Dew 290, Trolli 280, Mug 2L 890, Crush 2L 890, Pepsi 250)
- deals-and-combos (Party Of One): 3 (CBP Melt 1170, Meat Lover's 1080, Pepperoni Lover's 1130 - the $7.00 melt variants)
- sauces/dips: NOT VERIFIED - mismatch found (snapshot Icing Dip Cup 170 vs site-displayed Icing Dip 180). Dips stay unknown.
