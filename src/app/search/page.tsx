import { applyFilters, filtersFromParams } from "../../modules/scoring/filters";
import { BRANDS, BrandIcon, imgSrc, card, ORANGE, ORANGE_TEXT, ORANGE_SOFT, MUTED, INK } from "../../components/brand";
import { loadData, rankEntrees } from "../../components/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "ValueBite - Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const zipParam = typeof params.zip === "string" ? params.zip : undefined;
  const { rows: allRows } = await loadData(zipParam);
  let rows = applyFilters(allRows.map((r) => ({ ...r, category: r.category ?? "" })), filters);
  if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q));
  const ranked = rankEntrees(rows);
  const results = q || filters.budget !== undefined || filters.restaurants?.length ? ranked.slice(0, 30) : [];

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "18px 16px 40px" }}>
      <header style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 30, margin: 0, letterSpacing: -1.2, fontWeight: 900, color: ORANGE }}>Search</h1>
        <p style={{ margin: "2px 0 0", color: MUTED, fontSize: 13.5, fontStyle: "italic" }}>craving something? find the best-value version</p>
      </header>

      <form method="get" style={{ ...card, borderRadius: 999, display: "flex", alignItems: "center", gap: 8, padding: "8px 8px 8px 16px", marginBottom: 10 }}>
        {zipParam && <input type="hidden" name="zip" value={zipParam} />}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9a9186" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          name="q" type="text" defaultValue={q} placeholder="burrito, whopper, nuggets..."
          style={{ border: "none", outline: "none", fontSize: 15, flex: 1, minWidth: 0, background: "transparent", color: INK, fontFamily: "inherit" }}
        />
        <input
          name="budget" type="number" step="0.01" min="0" defaultValue={filters.budget} placeholder="max $"
          style={{ border: "none", outline: "none", fontSize: 14, width: 64, background: "transparent", color: INK, fontFamily: "inherit" }}
        />
        <button type="submit" style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 999, padding: "9px 18px", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          Go
        </button>
      </form>

      {(q || filters.budget !== undefined) && (
        <a href={`/search${zipParam ? `?zip=${zipParam}` : ""}`} style={{ fontSize: 13, color: MUTED, textDecoration: "none" }}>clear</a>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {results.map(({ row, score }) => (
          <div key={`${row.restaurantSlug}:${row.productId}`} style={{ ...card, padding: 12, display: "flex", alignItems: "center", gap: 12 }}>
            {row.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imgSrc(row.imageUrl)} alt={row.name} width={56} height={56} loading="lazy"
                style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 16, flexShrink: 0, background: "#f7f4ef" }} />
            ) : (
              <BrandIcon slug={row.restaurantSlug} size={56} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.25, color: INK }}>{row.name}</div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 3 }}>
                {BRANDS[row.restaurantSlug]?.name ?? row.restaurantSlug}
                {row.calories !== null ? ` · ${row.calories} cal` : ""}
                {row.proteinG !== null ? ` · ${row.proteinG}g protein` : ""}
              </div>
              {row.calories !== null && row.calories > 0 && (
                <span style={{ display: "inline-block", marginTop: 5, background: ORANGE_SOFT, color: ORANGE_TEXT, borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 700 }}>
                  {Math.round(row.calories / row.price)} cal/$
                </span>
              )}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 19, color: ORANGE, lineHeight: 1 }}>{score.toFixed(1)}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: INK, marginTop: 3 }}>
                {row.pricingType !== "exact_store" && "~"}${row.price.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {(q || filters.budget !== undefined) && results.length === 0 && (
        <p style={{ color: MUTED, fontSize: 14, marginTop: 20, textAlign: "center" }}>Nothing matches that yet. Try a different word or a bigger budget.</p>
      )}
      {!q && filters.budget === undefined && (
        <p style={{ color: MUTED, fontSize: 14, marginTop: 20, textAlign: "center" }}>Type a craving or set a max budget - results come ranked by value score.</p>
      )}
    </main>
  );
}
