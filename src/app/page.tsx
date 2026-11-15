import { openDb } from "../modules/db/client";
import { rankableRows, activeDeals } from "../modules/db/queries";
import { readSnapshot } from "../modules/db/snapshot";
import { scorePopulation, rank as rankScores } from "../modules/scoring/engine";
import { entrees } from "../modules/scoring/rank";
import { applyFilters, filtersFromParams } from "../modules/scoring/filters";

export const dynamic = "force-dynamic";

const ZIP = "33613";

/** Real app icons, served locally from /public/icons (official App Store artwork). */
const BRANDS: Record<string, { initials: string; bg: string; fg: string; name: string }> = {
  "taco-bell": { initials: "TB", bg: "#702082", fg: "#fff", name: "Taco Bell" },
  dominos: { initials: "D", bg: "#006491", fg: "#fff", name: "Domino's" },
  "chick-fil-a": { initials: "CFA", bg: "#e51636", fg: "#fff", name: "Chick-fil-A" },
  "burger-king": { initials: "BK", bg: "#f5ebdc", fg: "#d62300", name: "Burger King" },
  chipotle: { initials: "C", bg: "#a81612", fg: "#fff", name: "Chipotle" },
};

/** Taco Bell's CDN blocks hotlinks, so their photos go through our proxy. */
function imgSrc(url: string): string {
  return `/api/img?u=${encodeURIComponent(url)}`;
}

function BrandIcon({ slug, size = 40 }: { slug: string; size?: number }) {
  const b = BRANDS[slug];
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: size * 0.24,
    border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, objectFit: "cover",
  };
  if (b) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/icons/${slug}.png`} alt={b.name} width={size} height={size} style={style} loading="lazy" />;
  }
  return (
    <span style={{ ...style, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#eee9e2", color: "#1c1c1e", fontWeight: 800, fontSize: size * 0.3 }}>
      {slug.slice(0, 2).toUpperCase()}
    </span>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 22,
  border: "1px solid #f0ebe3",
  boxShadow: "0 2px 10px rgba(60,40,20,0.05)",
};

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const snap = readSnapshot();
  let allRows, deals;
  if (snap) {
    allRows = snap.rows;
    deals = snap.deals;
  } else {
    const { db, client } = await openDb("./data/pgdb");
    allRows = await rankableRows(db, ZIP);
    deals = await activeDeals(db);
    await client.close();
  }
  const rows = applyFilters(allRows.map((r) => ({ ...r, category: r.category ?? "" })), filters);

  const scored = scorePopulation(
    rows.map((r) => ({ id: `${r.restaurantSlug}:${r.productId}`, price: r.price, calories: r.calories, protein: r.proteinG })),
  );
  const byId = new Map(rows.map((r) => [`${r.restaurantSlug}:${r.productId}`, r]));
  const withScores = rankScores(scored, "value")
    .map((s) => ({ s, row: byId.get(s.id)! }))
    .filter(({ row }) => row !== undefined);

  const entreeRows = entrees(rows.map((r) => ({ ...r, calories: r.calories, category: r.category ?? "" })));
  const entreeKeys = new Set(entreeRows.map((r) => `${r.restaurantSlug}:${r.productId}`));
  const byValue = withScores.filter(({ s }) => entreeKeys.has(s.id) && s.valueScore !== null).slice(0, 10);

  interface DealView {
    key: string; title: string; slug: string; priceText: string;
    calPerDollar: string | null; sortCal: number; imageUrl: string | null;
  }
  const dealViews: DealView[] = [];
  for (const r of allRows.filter((r) => r.category === "deals-and-combos")) {
    const calMin = r.calories ?? r.caloriesMin;
    const calMax = r.calories ?? r.caloriesMax;
    dealViews.push({
      key: `tb:${r.productId}`,
      title: r.name,
      slug: r.restaurantSlug,
      priceText: `$${r.price.toFixed(2)}`,
      calPerDollar: calMin !== null && calMax !== null && calMin > 0 ? `${Math.round(calMin / r.price)}-${Math.round(calMax / r.price)} cal/$` : calMin === 0 ? "drinks" : null,
      sortCal: calMin !== null && calMax !== null && calMax > 0 ? calMax / r.price : -1,
      imageUrl: r.imageUrl ?? null,
    });
  }
  for (const d of deals.filter((d) => d.expiresAt !== null)) {
    const slug = Object.keys(BRANDS).find((k) => BRANDS[k]!.name === d.restaurantName) ?? "dominos";
    dealViews.push({
      key: `dm:${d.promoCode}`,
      title: d.title,
      slug,
      priceText: d.price !== null ? `$${d.price.toFixed(2)} w/ ${d.promoCode}` : `code ${d.promoCode}`,
      calPerDollar: null,
      sortCal: -1,
      imageUrl: null,
    });
  }
  dealViews.sort((x, y) => y.sortCal - x.sortCal || x.title.localeCompare(y.title));
  const topDeals = dealViews.slice(0, 12);

  const activeRestaurant = filters.restaurants?.[0] ?? "";
  const checked = snap?.generatedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px 48px" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0, letterSpacing: -0.8, fontWeight: 800 }}>ValueBite</h1>
          <p style={{ margin: "2px 0 0", color: "#8a8378", fontSize: 14 }}>Most food for your money near <strong>{ZIP}</strong></p>
        </div>
      </header>

      {/* Budget search pill */}
      <form method="get" style={{ ...card, display: "flex", alignItems: "center", gap: 10, padding: "8px 8px 8px 18px", marginBottom: 14, borderRadius: 999 }}>
        <span style={{ fontSize: 15, color: "#8a8378" }}>$</span>
        <input
          name="budget" type="number" step="0.01" min="0" defaultValue={filters.budget} placeholder="What's the budget?"
          style={{ border: "none", outline: "none", fontSize: 15, flex: 1, minWidth: 0, background: "transparent", color: "#1c1c1e" }}
        />
        {activeRestaurant && <input type="hidden" name="restaurant" value={activeRestaurant} />}
        <button type="submit" style={{ background: "#06c167", color: "#fff", border: "none", borderRadius: 999, padding: "10px 20px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Find food
        </button>
        {(filters.budget !== undefined || activeRestaurant) && (
          <a href="/" style={{ color: "#8a8378", fontSize: 13, textDecoration: "none", paddingRight: 8 }}>reset</a>
        )}
      </form>

      {/* Restaurant chips */}
      <nav style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 24 }}>
        <a
          href={filters.budget !== undefined ? `/?budget=${filters.budget}` : "/"}
          style={{
            ...card, borderRadius: 999, padding: "8px 16px", display: "flex", alignItems: "center",
            textDecoration: "none", color: "#1c1c1e", fontSize: 14, fontWeight: activeRestaurant ? 500 : 700,
            border: activeRestaurant ? "1px solid #f0ebe3" : "2px solid #1c1c1e", whiteSpace: "nowrap",
          }}
        >
          All
        </a>
        {Object.entries(BRANDS).map(([slug, b]) => {
          const active = activeRestaurant === slug;
          const href = filters.budget !== undefined ? `/?restaurant=${slug}&budget=${filters.budget}` : `/?restaurant=${slug}`;
          return (
            <a
              key={slug}
              href={href}
              style={{
                ...card, borderRadius: 999, padding: "5px 14px 5px 5px", display: "flex", alignItems: "center", gap: 8,
                textDecoration: "none", color: "#1c1c1e", fontSize: 14, fontWeight: active ? 700 : 500,
                border: active ? "2px solid #1c1c1e" : "1px solid #f0ebe3", whiteSpace: "nowrap",
              }}
            >
              <BrandIcon slug={slug} size={28} />
              {b.name}
            </a>
          );
        })}
      </nav>

      {/* Deals first - the promos, up top */}
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 21, margin: "0 0 12px", letterSpacing: -0.4 }}>Today's best deals</h2>
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 6 }}>
          {topDeals.map((d) => (
            <div key={d.key} style={{ ...card, minWidth: 210, maxWidth: 210, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              {d.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgSrc(d.imageUrl)} alt={d.title} loading="lazy"
                  style={{ width: "100%", height: 128, objectFit: "cover", background: "#f6f3ee" }} />
              ) : (
                <div style={{ width: "100%", height: 96, background: "#f6f3ee", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BrandIcon slug={d.slug} size={44} />
                </div>
              )}
              <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25 }}>{d.title}</div>
                <div style={{ fontSize: 13, color: "#8a8378" }}>{BRANDS[d.slug]?.name ?? d.slug} · {d.priceText}</div>
                {d.calPerDollar && (
                  <span style={{ alignSelf: "flex-start", marginTop: 4, background: "#e6f7ee", color: "#067647", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                    {d.calPerDollar}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Best value list */}
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 21, margin: "0 0 12px", letterSpacing: -0.4 }}>Best value right now</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {byValue.map(({ s, row }, i) => (
            <div key={s.id} style={{ ...card, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#c9c2b6", width: 18, textAlign: "center" }}>{i + 1}</span>
              {row.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgSrc(row.imageUrl)} alt={row.name} width={64} height={64} loading="lazy"
                  style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 16, flexShrink: 0, background: "#f6f3ee" }} />
              ) : (
                <BrandIcon slug={row.restaurantSlug} size={64} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25 }}>{row.name}</div>
                <div style={{ fontSize: 13, color: "#8a8378", marginTop: 3 }}>
                  {BRANDS[row.restaurantSlug]?.name ?? row.restaurantSlug}
                  {row.calories !== null ? ` · ${row.calories} cal` : ""}
                  {row.proteinG !== null ? ` · ${row.proteinG}g protein` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {row.pricingType !== "exact_store" && <span title="typical price, may vary">~</span>}${row.price.toFixed(2)}
                </div>
                <div style={{ background: "#e6f7ee", color: "#067647", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700, marginTop: 3 }}>
                  {s.valueScore!.toFixed(1)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Official codes */}
      <section style={{ marginBottom: 30 }}>
        <h2 style={{ fontSize: 21, margin: "0 0 12px", letterSpacing: -0.4 }}>Official codes</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {deals.map((d, i) => {
            const slug = Object.keys(BRANDS).find((k) => BRANDS[k]!.name === d.restaurantName) ?? "dominos";
            return (
              <div key={i} style={{ ...card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <BrandIcon slug={slug} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{d.title}</div>
                  {d.expiresAt && <div style={{ fontSize: 12, color: "#8a8378", marginTop: 2 }}>expires {d.expiresAt.slice(0, 10)}</div>}
                </div>
                {d.promoCode && (
                  <span style={{ fontFamily: "monospace", background: "#f6f3ee", borderRadius: 10, padding: "6px 10px", fontSize: 13, fontWeight: 700 }}>
                    {d.promoCode}
                  </span>
                )}
                {d.price !== null && <span style={{ fontWeight: 700, fontSize: 15 }}>${d.price.toFixed(2)}</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* About / honesty notes */}
      <details style={{ ...card, padding: "12px 16px", fontSize: 13, color: "#8a8378" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, color: "#6b655b" }}>How ValueBite works</summary>
        <div style={{ marginTop: 10, lineHeight: 1.6, display: "flex", flexDirection: "column", gap: 6 }}>
          <div>Value Score V1 ranks entrees by 55% protein per $, 35% calories per $, 10% price. Only items with known protein get a score - protein is never guessed.</div>
          <div>Prices marked ~ are typical prices and may vary by store (exact data takes longer). Everything else is the exact price from the restaurant's own ordering site near {ZIP}.</div>
          <div>Deals and codes come from the restaurant's official ordering site or deals menu, checked {checked}. A code is listed by the official source - not a guarantee it works at checkout.</div>
          <div>Product photos are the restaurant's official menu photos. Chains without published photos show their app icon instead.</div>
          <div><a href="/compare" style={{ color: "#067647" }}>Compare items side by side</a> · <a href="/admin" style={{ color: "#067647" }}>Data sources & refresh log</a></div>
        </div>
      </details>
    </main>
  );
}
