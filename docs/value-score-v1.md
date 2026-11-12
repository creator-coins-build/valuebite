# VALUE_SCORE_V1

Deterministic, versioned. ValueScore = 10 x (0.55 P + 0.35 C + 0.10 A), each in 0..1.

- cal/$ = calories / price. protein/$ = protein g / price. Price is the total paid for everything received (deals use effective price and full quantity).
- C, P: natural-log min-max of cal/$ and protein/$, clamped to 0..1.
  - Bounds: 5th and 95th percentile of the comparison population (needs >=5 items with each metric). Smaller populations use fixed reference bounds: cal/$ 30-300, protein/$ 1-20.
- A (affordability): 1 - lognorm(price, $1..$20), fixed bounds.
- Score is rounded to 1 decimal. Labels: >=9 Excellent, >=8 Great, >=7 Good, >=5 Average, else Poor.
- Unknown protein is never 0: the item gets no Value Score, but still ranks in cal/$ and cheapest modes.
- Invalid records (price<=0, missing price/calories, negatives, price>$200, calories>10,000, protein>600g, protein calories exceeding total, duplicate ids) are never ranked.
- Scores are only comparable inside one population (context). Any constant change = new version.
- No restaurant, sponsor or affiliate input exists in the formula.
