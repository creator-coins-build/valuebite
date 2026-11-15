import { openDb } from "../../modules/db/client";
import { activeDeals } from "../../modules/db/queries";
import { readSnapshot } from "../../modules/db/snapshot";
import { BRANDS, BrandIcon, brandSlugFor, card, ORANGE, MUTED, INK } from "../../components/brand";

export const dynamic = "force-dynamic";

export default async function CodesPage() {
  const snap = readSnapshot();
  let deals;
  let checked: string;
  if (snap) {
    deals = snap.deals;
    checked = snap.generatedAt.slice(0, 10);
  } else {
    const { db, client } = await openDb("./data/pgdb");
    deals = await activeDeals(db);
    checked = new Date().toISOString().slice(0, 10);
    await client.close();
  }

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px 32px" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 32, margin: 0, letterSpacing: -1.2, fontWeight: 900, color: ORANGE }}>Codes</h1>
        <p style={{ margin: "2px 0 0", color: MUTED, fontSize: 14, fontStyle: "italic" }}>
          straight from the restaurants' official ordering sites
        </p>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {deals.map((d, i) => {
          const slug = brandSlugFor(d.restaurantName);
          return (
            <div key={i} style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <BrandIcon slug={slug} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, color: INK, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.title}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
                  {BRANDS[slug]?.name ?? d.restaurantName}
                  {d.expiresAt ? ` · expires ${d.expiresAt.slice(0, 10)}` : " · no expiry published"}
                </div>
              </div>
              {d.promoCode && (
                <span style={{ fontFamily: "monospace", background: "#26221c", color: "#ffa245", borderRadius: 10, padding: "8px 12px", fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>
                  {d.promoCode}
                </span>
              )}
              {d.price !== null && <span style={{ fontWeight: 800, fontSize: 16, color: INK }}>${d.price.toFixed(2)}</span>}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: "#575046", lineHeight: 1.6 }}>
        Listed by the official source, checked {checked}. A code being listed isn't a guarantee it works at checkout.
      </p>
    </main>
  );
}
