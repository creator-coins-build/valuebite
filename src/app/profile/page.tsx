import { BRANDS, BrandIcon, card, ORANGE, ORANGE_TEXT, MUTED, INK } from "../../components/brand";
import { loadData } from "../../components/data";
import { ZipForm } from "../../components/ZipForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "ValueBite - Profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const zipParam = typeof params.zip === "string" ? params.zip : undefined;
  const { rows, deals, checked, zip, stores, live } = await loadData(zipParam);
  const chainCount = new Set(rows.map((r) => r.restaurantSlug)).size;
  const exactCount = rows.filter((r) => r.pricingType === "exact_store").length;

  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "18px 16px 40px" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 30, margin: 0, letterSpacing: -1.2, fontWeight: 900, color: ORANGE }}>Profile</h1>
        <p style={{ margin: "2px 0 0", color: MUTED, fontSize: 13.5, fontStyle: "italic" }}>your area, your data, how it all works</p>
      </header>

      {/* Area card */}
      <section style={{ ...card, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Your area</div>
        <div style={{ fontSize: 26, fontWeight: 900, color: INK, marginTop: 4 }}>{zip}</div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 2 }}>{zip === "33613" ? "USF Tampa - prices are pulled for stores near this ZIP" : "prices are pulled live for stores near this ZIP"}</div>
        <div style={{ marginTop: 10 }}><ZipForm zip={zip} action="/profile" /></div>
        {live && stores.length > 0 && (
          <div style={{ fontSize: 12, color: MUTED, marginTop: 8 }}>{stores.map(s => `${s.slug} - ${s.address}`).join("\n")}</div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {Object.keys(BRANDS).map((slug) => (
            <BrandIcon key={slug} slug={slug} size={34} />
          ))}
        </div>
      </section>

      {/* Data stats */}
      <section style={{ ...card, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>The data</div>
        <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: INK }}>{rows.length}</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>menu items</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: INK }}>{chainCount}</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>restaurants</div>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: INK }}>{deals.length}</div>
            <div style={{ fontSize: 12.5, color: MUTED }}>live deals</div>
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: MUTED, marginTop: 12, lineHeight: 1.6 }}>
          Refreshed daily from the restaurants' own ordering sites. Last refresh: {checked}. {exactCount} of {rows.length} prices are exact store prices; the rest are labeled typical (~) until exact data lands.
        </div>
      </section>

      {/* How it works */}
      <section style={{ ...card, padding: 18, marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: MUTED, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>How ValueBite works</div>
        <div style={{ fontSize: 13.5, color: "#5c554b", lineHeight: 1.7, marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <div>Value Score V1 ranks entrees by 55% protein per $, 35% calories per $, 10% price. Only items with known protein get a score - protein is never guessed.</div>
          <div>Prices marked ~ are typical prices and may vary by store. Everything else is the exact price from the restaurant's own ordering site near {zip}.</div>
          <div>Deals and codes come from the restaurant's official ordering site or deals menu, checked {checked}. A code is listed by the official source - not a guarantee it works at checkout.</div>
          <div>Product photos are the restaurant's official menu photos. Chains without published photos show their app icon instead.</div>
        </div>
      </section>

      {/* Links */}
      <section style={{ ...card, padding: 6, overflow: "hidden" }}>
        <a href="/compare" style={{ display: "block", padding: "14px 16px", textDecoration: "none", color: ORANGE_TEXT, fontWeight: 700, fontSize: 14.5, borderBottom: "1px solid #efe9e1" }}>
          Compare items side by side
        </a>
        <a href="/admin" style={{ display: "block", padding: "14px 16px", textDecoration: "none", color: ORANGE_TEXT, fontWeight: 700, fontSize: 14.5 }}>
          Data sources & refresh log
        </a>
      </section>
    </main>
  );
}
