import { applyFilters, filtersFromParams } from "../../modules/scoring/filters";
import { BRANDS, BrandIcon, imgSrc, card, ORANGE, ORANGE_TEXT, ORANGE_SOFT, MUTED, INK } from "../../components/brand";
import { loadData, rankEntrees } from "../../components/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "ValueBite - Top rated" };

export default async function TopPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const { rows: allRows } = await loadData();
  const rows = applyFilters(allRows.map((r) => ({ ...r, category: r.category ?? "" })), filters);
  const ranked = rankEntrees(rows).slice(0, 25);
  const activeRestaurant = filters.restaurants?.[0] ?? "";

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "18px 16px 40px" }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 30, margin: 0, letterSpacing: -1.2, fontWeight: 900, color: ORANGE }}>Top rated</h1>
        <p style={{ margin: "2px 0 0", color: MUTED, fontSize: 13.5, fontStyle: "italic" }}>the most food for your money, scored</p>
      </header>

      {/* Restaurant filter chips */}
      <nav style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 16 }}>
        <a href="/top" style={{ ...card, borderRadius: 999, padding: "7px 14px", textDecoration: "none", color: INK, fontSize: 13.5, fontWeight: activeRestaurant ? 500 : 700, border: activeRestaurant ? "1px solid #efe9e1" : `2px solid ${ORANGE}`, whiteSpace: "nowrap" }}>All</a>
        {Object.entries(BRANDS).map(([slug, b]) => {
          const active = activeRestaurant === slug;
          return (
            <a key={slug} href={active ? "/top" : `/top?restaurant=${slug}`} style={{ ...card, borderRadius: 999, padding: "4px 12px 4px 4px", display: "flex", alignItems: "center", gap: 7, textDecoration: "none", color: INK, fontSize: 13.5, fontWeight: active ? 700 : 500, border: active ? `2px solid ${ORANGE}` : "1px solid #efe9e1", whiteSpace: "nowrap" }}>
              <BrandIcon slug={slug} size={26} />
              {b.name}
            </a>
          );
        })}
      </nav>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {ranked.map(({ row, score }, i) => (
          <div key={`${row.restaurantSlug}:${row.productId}`} style={{ ...card, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#c9c0b4", width: 18, textAlign: "center" }}>{i + 1}</span>
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc(row.imageUrl)} alt={row.name} width={64} height={64} loading="lazy"
                style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 18, flexShrink: 0, background: "#f7f4ef" }} />
            ) : (
              <BrandIcon slug={row.restaurantSlug} size={64} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.25, color: INK }}>{row.name}</div>
              <div style={{ fontSize: 13, color: MUTED, marginTop: 3 }}>
                {BRANDS[row.restaurantSlug]?.name ?? row.restaurantSlug}
                {row.calories !== null ? ` · ${row.calories} cal` : ""}
                {row.proteinG !== null ? ` · ${row.proteinG}g protein` : ""}
              </div>
              <div style={{ marginTop: 5, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {row.calories !== null && row.calories > 0 && (
                  <span style={{ background: ORANGE_SOFT, color: ORANGE_TEXT, borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 700 }}>
                    {Math.round(row.calories / row.price)} cal/$
                  </span>
                )}
                {row.calories === null && row.caloriesMin !== null && row.caloriesMax !== null && row.caloriesMax > 0 && (
                  <span style={{ background: ORANGE_SOFT, color: ORANGE_TEXT, borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 700 }}>
                    {Math.round(row.caloriesMin / row.price)}-{Math.round(row.caloriesMax / row.price)} cal/$
                  </span>
                )}
                {row.proteinG !== null && row.proteinG > 0 && (
                  <span style={{ background: "#f1ece4", color: "#6b6459", borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 700 }}>
                    {(row.proteinG / row.price).toFixed(1)}g protein/$
                  </span>
                )}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 22, color: ORANGE, lineHeight: 1 }}>{score.toFixed(1)}</div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: INK, marginTop: 4 }}>
                {row.pricingType !== "exact_store" && "~"}${row.price.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12.5, color: "#b3ab9e", lineHeight: 1.6, marginTop: 16 }}>
        Value Score V1: 55% protein per $, 35% calories per $, 10% price. Entrees only; protein is never guessed. Prices marked ~ are typical prices and may vary.
      </p>
    </main>
  );
}
