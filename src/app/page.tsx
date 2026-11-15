import { DigitalOffers } from "../components/DigitalOffers";
import { entrees } from "../modules/scoring/rank";
import { applyFilters, filtersFromParams } from "../modules/scoring/filters";
import { BRANDS, BrandIcon, brandSlugFor, imgSrc, wideSrc, card, ORANGE, ORANGE_TEXT, ORANGE_SOFT, MUTED, INK } from "../components/brand";
import { loadData, ZIP } from "../components/data";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const { rows: allRows, deals } = await loadData();
  const rows = applyFilters(allRows.map((r) => ({ ...r, category: r.category ?? "" })), filters);

  // Deals: chain deal-category items + official coupons, best cal/$ first.
  interface DealView {
    key: string; title: string; slug: string; price: number | null; priceText: string;
    calPerDollar: string | null; sortCal: number; imageUrl: string | null;
  }
  const dealViews: DealView[] = [];
  for (const r of rows.filter((r) => r.category === "deals-and-combos")) {
    const calMin = r.calories ?? r.caloriesMin;
    const calMax = r.calories ?? r.caloriesMax;
    dealViews.push({
      key: `tb:${r.productId}`,
      title: r.name,
      slug: r.restaurantSlug,
      price: r.price,
      priceText: `$${r.price.toFixed(2)}`,
      calPerDollar: calMin !== null && calMax !== null && calMin > 0 ? `${Math.round(calMin / r.price)}-${Math.round(calMax / r.price)} cal/$` : calMin === 0 ? "drinks" : null,
      sortCal: calMin !== null && calMax !== null && calMax > 0 ? calMax / r.price : -1,
      imageUrl: r.imageUrl ?? null,
    });
  }
  if (!filters.restaurants?.length || filters.restaurants.includes("dominos")) {
    for (const d of deals.filter((d) => d.expiresAt !== null).slice(0, 4)) {
      dealViews.push({
        key: `dm:${d.promoCode}`,
        title: d.title,
        slug: brandSlugFor(d.restaurantName),
        price: d.price,
        priceText: d.price !== null ? `$${d.price.toFixed(2)} w/ ${d.promoCode}` : `code ${d.promoCode}`,
        calPerDollar: null,
        sortCal: -1,
        imageUrl: null,
      });
    }
  }
  const digitalNames = new Set(deals.filter(d => d.redemption === "online" || d.appOnly).map(d => d.title));
  dealViews.sort((x, y) => Number(digitalNames.has(y.title)) - Number(digitalNames.has(x.title)) || y.sortCal - x.sortCal || x.title.localeCompare(y.title));
  // Hero-worthy = food, not drink-only packs (a 0-cal floor means beverages).
  const heroDeals = dealViews.filter(d => digitalNames.has(d.title) && d.calPerDollar !== "drinks").slice(0, 5);

  // App/online-exclusive deals from official sources (currently Taco Bell's
  // "Member exclusive" + "Online exclusives" menu categories).

  // Crowd favorites: photo'd ENTREES with the most calories per dollar (sauces/packets excluded).
  const entreeKeySet = new Set(entrees(rows).map((r) => `${r.restaurantSlug}:${r.productId}`));
  const favorites = rows
    .filter((r) => r.imageUrl && (r.calories ?? 0) > 0 && entreeKeySet.has(`${r.restaurantSlug}:${r.productId}`))
    .sort((a, b) => (b.calories! / b.price) - (a.calories! / a.price))
    .slice(0, 4);

  const activeRestaurant = filters.restaurants?.[0] ?? "";

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "18px 16px 40px" }}>
      {/* Header */}
      <header style={{ textAlign: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 34, margin: 0, letterSpacing: -1.4, fontWeight: 900, color: ORANGE }}>ValueBite</h1>
        <p style={{ margin: "1px 0 0", color: MUTED, fontSize: 13.5, fontStyle: "italic" }}>eat good. spend less. near {ZIP}</p>
      </header>

      {/* Restaurant chips */}
      <nav style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 18 }}>
        <a
          href="/"
          style={{
            ...card, borderRadius: 999, padding: "7px 14px", display: "flex", alignItems: "center",
            textDecoration: "none", color: INK, fontSize: 13.5, fontWeight: activeRestaurant ? 500 : 700,
            border: activeRestaurant ? "1px solid #efe9e1" : `2px solid ${ORANGE}`, whiteSpace: "nowrap",
          }}
        >
          All
        </a>
        {Object.entries(BRANDS).map(([slug, b]) => {
          const active = activeRestaurant === slug;
          return (
            <a
              key={slug}
              href={active ? "/" : `/?restaurant=${slug}`}
              style={{
                ...card, borderRadius: 999, padding: "4px 12px 4px 4px", display: "flex", alignItems: "center", gap: 7,
                textDecoration: "none", color: INK, fontSize: 13.5, fontWeight: active ? 700 : 500,
                border: active ? `2px solid ${ORANGE}` : "1px solid #efe9e1", whiteSpace: "nowrap",
              }}
            >
              <BrandIcon slug={slug} size={26} />
              {b.name}
            </a>
          );
        })}
      </nav>

      {/* Hero deals - Popeyes-style big photo cards */}
      <section style={{ marginBottom: 26 }}>
        <h2 style={{ fontSize: 22, margin: "0 0 12px", letterSpacing: -0.5, fontWeight: 800 }}>App & online picks</h2>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, scrollSnapType: "x mandatory" }}>
          {heroDeals.map((d) => (
            <div key={d.key} style={{ ...card, minWidth: "86%", overflow: "hidden", position: "relative", scrollSnapAlign: "center", padding: 0 }}>
              {d.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={wideSrc(d.imageUrl)} alt={d.title} loading="lazy"
                  style={{ width: "100%", height: 190, objectFit: "cover", display: "block", background: "#f1ece4" }} />
              ) : (
                <div style={{ width: "100%", height: 150, background: "#f1ece4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BrandIcon slug={d.slug} size={56} />
                </div>
              )}
              {d.price !== null && (
                <div style={{
                  position: "absolute", top: 12, right: 12, width: 58, height: 58, borderRadius: "50%",
                  background: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 900, fontSize: 16, color: ORANGE, boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
                }}>
                  ${d.price.toFixed(2)}
                </div>
              )}
              <div style={{ padding: "12px 14px 14px" }}>
                <div style={{ fontWeight: 800, fontSize: 16.5, lineHeight: 1.25, color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.title}</div>
                <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>{BRANDS[d.slug]?.name ?? d.slug}{d.price === null ? ` · ${d.priceText}` : ""}</div>
                {digitalNames.has(d.title) && <span style={{ display: "inline-block", background: "#191512", color: "white", borderRadius: 999, padding: "3px 9px", fontSize: 11, marginTop: 7, marginRight: 6 }}>App + online</span>}
                {d.calPerDollar && (
                  <span style={{ display: "inline-block", marginTop: 7, background: ORANGE_SOFT, color: ORANGE_TEXT, borderRadius: 999, padding: "3px 11px", fontSize: 12.5, fontWeight: 700 }}>
                    {d.calPerDollar}
                  </span>
                )}
                {digitalNames.has(d.title) && <a href={BRANDS[d.slug]!.appStoreUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12, borderRadius: 999, background: ORANGE, color: "white", padding: "10px 16px", textAlign: "center", textDecoration: "none", fontWeight: 900, fontSize: 14 }}>Get Deal</a>}
                {digitalNames.has(d.title) && <details style={{ marginTop: 7, color: MUTED, fontSize: 11 }}><summary>How to get it</summary><ol style={{ margin: "6px 0", paddingLeft: 18, lineHeight: 1.6 }}><li>Open the Taco Bell app (or tacobell.com) and sign in - a Rewards account is free.</li><li>Find it in the menu under Online Exclusives / Member Exclusives.</li><li>Build it, pick your store and order ahead for pickup. Price shown is for our selected store, before tax.</li></ol><a href={deals.find(x => x.title === d.title)?.sourceUrl} style={{ color: MUTED }}>Official source</a></details>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <DigitalOffers restaurant={activeRestaurant} />

      {/* Crowd favorites - 2-col grid with circular photos */}
      <section style={{ marginBottom: 26 }}>
        <h2 style={{ fontSize: 22, margin: "0 0 12px", letterSpacing: -0.5, fontWeight: 800 }}>Crowd favorites</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {favorites.map((row) => (
            <div key={`${row.restaurantSlug}:${row.productId}`} style={{ ...card, padding: "16px 12px 14px", textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgSrc(row.imageUrl!)} alt={row.name} loading="lazy"
                style={{ width: 110, height: 110, objectFit: "cover", borderRadius: "50%", background: "#f7f4ef", margin: "0 auto 10px", display: "block" }} />
              <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.25, color: INK, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 35 }}>{row.name}</div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 4 }}>
                {row.pricingType !== "exact_store" && "~"}${row.price.toFixed(2)}
              </div>
              <span style={{ display: "inline-block", marginTop: 6, background: ORANGE, color: "#fff", borderRadius: 999, padding: "3px 12px", fontSize: 12.5, fontWeight: 800 }}>
                {Math.round(row.calories! / row.price)} cal/$
              </span>
            </div>
          ))}
        </div>
      </section>

      <p style={{ textAlign: "center", fontSize: 13, color: MUTED }}>
        <a href="/top" style={{ color: ORANGE_TEXT, fontWeight: 700, textDecoration: "none" }}>See the full ranked list</a>
      </p>
    </main>
  );
}
