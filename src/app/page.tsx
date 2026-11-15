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

function BrandTile({ slug, size = 40 }: { slug: string; size?: number }) {
  const b = BRANDS[slug] ?? { initials: slug.slice(0, 2).toUpperCase(), bg: "#e8e6e3", fg: "#1c1c1e" };
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: size * 0.24,
    border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, objectFit: "cover",
  };
  if (BRANDS[slug]) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/icons/${slug}.png`} alt={`${BRANDS[slug]!.name} app icon`} width={size} height={size} style={style} loading="lazy" />;
  }
  return (
    <span style={{ ...style, display: "inline-flex", alignItems: "center", justifyContent: "center", background: b.bg, color: b.fg, fontWeight: 800, fontSize: size * 0.3 }}>
      {b.initials}
    </span>
  );
}

/** Route official chain photos through /api/img (their CDN blocks hotlinks). */
function imgSrc(url: string): string {
  return `/api/img?u=${encodeURIComponent(url)}`;
}

function priceLabel(pricingType: string): string | null {
  switch (pricingType) {
    case "exact_store":
      return "Exact store price";
    case "zip_local":
      return "Local estimate";
    case "regional":
      return "Regional estimate";
    default:
      return "Typical price - may vary (exact data takes longer)";
  }
}

const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  border: "1px solid #eceae6",
  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
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

  // Deals first: chain deal-category items + official coupons, sorted by cal/$ (best first).
  interface DealView {
    key: string; title: string; slug: string; priceText: string; calText: string;
    calPerDollar: string | null; sortCal: number; evidence: string; imageUrl: string | null;
  }
  const dealViews: DealView[] = [];
  for (const r of allRows.filter((r) => r.category === "deals-and-combos")) {
    const hasRange = r.caloriesMin !== null && r.caloriesMax !== null;
    const calMin = r.calories ?? r.caloriesMin;
    const calMax = r.calories ?? r.caloriesMax;
    dealViews.push({
      key: `tb:${r.productId}`,
      title: r.name,
      slug: r.restaurantSlug,
      priceText: `$${r.price.toFixed(2)}`,
      calText: hasRange ? `${r.caloriesMin}-${r.caloriesMax} cal` : r.calories !== null ? `${r.calories} cal` : "cal unknown",
      calPerDollar: calMin !== null && calMax !== null && calMin > 0 ? `${Math.round(calMin / r.price)}-${Math.round(calMax / r.price)} cal/$` : calMin === 0 ? "0 (drinks)" : null,
      sortCal: calMin !== null && calMax !== null && calMax > 0 ? calMax / r.price : -1,
      evidence: "official deals menu, checked " + new Date(r.fetchedAt).toISOString().slice(0, 10),
      imageUrl: r.imageUrl ?? null,
    });
  }
  for (const d of deals.filter((d) => d.expiresAt !== null)) {
    const slug = Object.keys(BRANDS).find((k) => BRANDS[k]!.name === d.restaurantName) ?? "dominos";
    dealViews.push({
      key: `dm:${d.promoCode}`,
      title: d.title,
      slug,
      priceText: d.price !== null ? `$${d.price.toFixed(2)} w/ code ${d.promoCode}` : `code ${d.promoCode}`,
      calText: "cal unknown",
      calPerDollar: null,
      sortCal: -1,
      evidence: `expires ${d.expiresAt!.slice(0, 10)}`,
      imageUrl: null,
    });
  }
  dealViews.sort((x, y) => y.sortCal - x.sortCal || x.title.localeCompare(y.title));
  const topDeals = dealViews.slice(0, 12);

  const activeRestaurant = filters.restaurants?.[0] ?? "";

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px 48px" }}>
      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, margin: 0, letterSpacing: -0.5 }}>ValueBite</h1>
          <p style={{ margin: "2px 0 0", color: "#6b6b70", fontSize: 14 }}>Best food value near <strong>{ZIP}</strong></p>
        </div>
        <span style={{ background: "#fff", border: "1px solid #eceae6", borderRadius: 999, padding: "8px 14px", fontSize: 13, color: "#6b6b70" }}>
          {rows.length} items
        </span>
      </header>

      {/* Budget search pill */}
      <form method="get" style={{ ...card, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", marginBottom: 14, borderRadius: 999 }}>
        <span style={{ color: "#6b6b70", fontSize: 14 }}>Budget</span>
        <input
          name="budget" type="number" step="0.01" min="0" defaultValue={filters.budget} placeholder="10"
          style={{ border: "none", outline: "none", fontSize: 16, width: 90, background: "transparent" }}
        />
        {activeRestaurant && <input type="hidden" name="restaurant" value={activeRestaurant} />}
        <button type="submit" style={{ marginLeft: "auto", background: "#06c167", color: "#fff", border: "none", borderRadius: 999, padding: "8px 18px", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          Find food
        </button>
        {(filters.budget !== undefined || activeRestaurant) && (
          <a href="/" style={{ color: "#6b6b70", fontSize: 13, textDecoration: "none" }}>reset</a>
        )}
      </form>

      {/* Restaurant chips */}
      <nav style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, marginBottom: 22 }}>
        <a
          href={filters.budget !== undefined ? `/?budget=${filters.budget}` : "/"}
          style={{
            ...card, borderRadius: 999, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8,
            textDecoration: "none", color: "#1c1c1e", fontSize: 14, fontWeight: activeRestaurant ? 500 : 700,
            border: activeRestaurant ? "1px solid #eceae6" : "2px solid #1c1c1e", whiteSpace: "nowrap",
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
                ...card, borderRadius: 999, padding: "6px 14px 6px 6px", display: "flex", alignItems: "center", gap: 8,
                textDecoration: "none", color: "#1c1c1e", fontSize: 14, fontWeight: active ? 700 : 500,
                border: active ? "2px solid #1c1c1e" : "1px solid #eceae6", whiteSpace: "nowrap",
              }}
            >
              <BrandTile slug={slug} size={28} />
              {b.name}
            </a>
          );
        })}
      </nav>

      {/* Deals first - the promos, up top */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, margin: "0 0 2px" }}>Today's best deals</h2>
        <p style={{ margin: "0 0 12px", color: "#6b6b70", fontSize: 13 }}>
          Official promos, sorted by calories per dollar. Codes come from the restaurant's own ordering site with their published expiry.
        </p>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
          {topDeals.map((d) => (
            <div key={d.key} style={{ ...card, minWidth: 230, maxWidth: 230, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              {d.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imgSrc(d.imageUrl)} alt={d.title} loading="lazy"
                  style={{ width: "100%", height: 118, objectFit: "cover", borderRadius: 12, background: "#f6f5f3" }} />
              )}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <BrandTile slug={d.slug} size={30} />
                <span style={{ fontSize: 12, color: "#6b6b70" }}>{BRANDS[d.slug]?.name ?? d.slug}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3 }}>{d.title}</div>
              <div style={{ fontSize: 14, color: "#1c1c1e" }}>{d.priceText}</div>
              <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                {d.calPerDollar ? (
                  <span style={{ background: "#e6f7ee", color: "#067647", borderRadius: 999, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{d.calPerDollar}</span>
                ) : (
                  <span style={{ background: "#f1efec", color: "#6b6b70", borderRadius: 999, padding: "3px 10px", fontSize: 12 }}>cal/$ unknown</span>
                )}
                <span style={{ fontSize: 11, color: "#9a9aa0" }}>{d.evidence}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Best value cards */}
      <section style={{ marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, margin: "0 0 2px" }}>Best value right now</h2>
        <p style={{ margin: "0 0 12px", color: "#6b6b70", fontSize: 13 }}>
          Value Score V1: 55% protein/$, 35% calories/$, 10% price. Entrees only. Only items with known protein get a score - protein is never guessed.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {byValue.map(({ s, row }, i) => {
            const pl = priceLabel(row.pricingType);
            return (
              <div key={s.id} style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#9a9aa0", width: 20, textAlign: "center" }}>{i + 1}</span>
                {row.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imgSrc(row.imageUrl)} alt={row.name} width={56} height={56} loading="lazy"
                    style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 14, border: "1px solid rgba(0,0,0,0.06)", background: "#f6f5f3", flexShrink: 0 }} />
                ) : (
                  <BrandTile slug={row.restaurantSlug} size={56} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{row.name}</div>
                  <div style={{ fontSize: 13, color: "#6b6b70", marginTop: 2 }}>
                    {row.calories !== null ? `${row.calories} cal` : "cal unknown"}
                    {row.proteinG !== null ? ` · ${row.proteinG}g protein` : " · protein unknown"}
                    {pl && row.pricingType !== "exact_store" && <span style={{ color: "#b7791f" }}> · {pl}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>${row.price.toFixed(2)}</div>
                  <div style={{ background: "#e6f7ee", color: "#067647", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700, marginTop: 3 }}>
                    {s.valueScore!.toFixed(1)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* All official codes */}
      <section>
        <h2 style={{ fontSize: 20, margin: "0 0 2px" }}>All official codes</h2>
        <p style={{ margin: "0 0 12px", color: "#6b6b70", fontSize: 13 }}>
          Listed by the restaurant's official ordering site. Shown only with freshness evidence.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {deals.map((d, i) => {
            const slug = Object.keys(BRANDS).find((k) => BRANDS[k]!.name === d.restaurantName) ?? "dominos";
            return (
              <div key={i} style={{ ...card, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <BrandTile slug={slug} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{d.title}</div>
                  <div style={{ fontSize: 12, color: "#9a9aa0", marginTop: 2 }}>
                    listed by official source, checked {d.lastVerified.slice(0, 10)}
                    {d.expiresAt ? ` · expires ${d.expiresAt.slice(0, 10)}` : " · no expiry published"}
                  </div>
                </div>
                {d.promoCode && (
                  <span style={{ fontFamily: "monospace", background: "#f1efec", borderRadius: 10, padding: "6px 10px", fontSize: 13, fontWeight: 700 }}>
                    {d.promoCode}
                  </span>
                )}
                {d.price !== null && <span style={{ fontWeight: 700, fontSize: 15 }}>${d.price.toFixed(2)}</span>}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
