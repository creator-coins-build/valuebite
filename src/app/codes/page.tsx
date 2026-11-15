import { DigitalOffers } from "../../components/DigitalOffers";
import { LocalNotice } from "../../components/LocalNotice";
import { openDb } from "../../modules/db/client";
import { activeDeals } from "../../modules/db/queries";
import { readSnapshot } from "../../modules/db/snapshot";
import { BRANDS, BrandIcon, brandSlugFor, card, ORANGE, MUTED, INK } from "../../components/brand";

export const dynamic = "force-dynamic";

export default async function CodesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const zipParam = typeof params.zip === "string" ? params.zip : undefined;
  const { loadData } = await import("../../components/data");
  const local = await loadData(zipParam);
  const { deals, checked } = local;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "20px 16px 32px" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 32, margin: 0, letterSpacing: -1.2, fontWeight: 900, color: ORANGE }}>Codes</h1>
        <p style={{ margin: "2px 0 0", color: MUTED, fontSize: 14, fontStyle: "italic" }}>
          straight from the restaurants' official ordering sites
        </p>
        {local && <LocalNotice {...local} compact />}
      </header>

      <DigitalOffers />
      <h2 style={{ fontSize: 22 }}>Official codes & digital exclusives</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {deals.map((d, i) => {
          const slug = brandSlugFor(d.restaurantName);
          if (slug === "papajohns") return (
            <article key={i} style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <BrandIcon slug={slug} size={40} />
                <div style={{ flex: 1, fontWeight: 800 }}>{d.title}</div>
                {d.price !== null && <strong>${d.price.toFixed(2)}</strong>}
              </div>
              <p style={{ fontSize: 12, color: MUTED }}>Papa John's · store 920 · sampled {d.lastVerified.slice(0, 10)} · no expiry published</p>
              {d.description && <p style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 700 }}>{d.description}</p>}
              {d.title === "Papa Pairings" && <p style={{ color: "#a13d10", fontWeight: 800, fontSize: 13 }}>Choose 2 or more eligible items. Shown price is not the total order price.</p>}
              <p style={{ fontSize: 13, lineHeight: 1.5 }}>Choose 14861 North Dale Mabry Hwy, Tampa for carryout. Open Deals and select this offer{d.promoCode ? " or enter the code below" : ""}. Check the full terms and final price there before ordering.</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                {d.promoCode && <code style={{ background: "#f1ece4", padding: "8px 12px", borderRadius: 10 }}>{d.promoCode}</code>}
                <a href={d.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "white", background: ORANGE, borderRadius: 999, padding: "9px 16px", textDecoration: "none", fontWeight: 800 }}>Official deals</a>
              </div>
            </article>
          );
          return (
            <div key={i} style={{ ...card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <BrandIcon slug={slug} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.3, color: INK, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.title}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>
                  {BRANDS[slug]?.name ?? d.restaurantName}
                  {d.expiresAt ? ` · expires ${d.expiresAt.slice(0, 10)}` : " · no expiry published"}
                  {slug === "papajohns" && ` · sampled ${d.lastVerified.slice(0, 10)}`}
                </div>
                {d.redemption && (
                  <span style={{ display: "inline-block", marginTop: 6, background: "#111", color: "#fff", borderRadius: 999, padding: "2px 10px", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.4, textTransform: "uppercase" }}>
                    {d.redemption === "app" ? "In app only" : "App + online"}
                  </span>
                )}
              </div>
              {slug === "papajohns" && <div style={{ fontSize: 12, color: MUTED, maxWidth: 200 }}>Choose store 920 at 14861 North Dale Mabry Hwy, Tampa, then select this offer under Deals or enter its code. Availability and terms may change.</div>}
              {d.redemption && BRANDS[slug]?.appStoreUrl ? (
                <a href={slug === "papajohns" ? d.sourceUrl : BRANDS[slug].appStoreUrl} target="_blank" rel="noopener noreferrer"
                  style={{ background: ORANGE, color: "#fff", borderRadius: 999, padding: "9px 16px", fontSize: 13.5, fontWeight: 800, textDecoration: "none", whiteSpace: "nowrap" }}>
                  Get Deal
                </a>
              ) : null}
              {d.promoCode && (
                <span style={{ fontFamily: "monospace", background: "#f1ece4", color: "#e85d10", borderRadius: 10, padding: "8px 12px", fontSize: 14, fontWeight: 700, letterSpacing: 0.5 }}>
                  {d.promoCode}
                </span>
              )}
              {d.price !== null && <span style={{ fontWeight: 800, fontSize: 16, color: INK }}>${d.price.toFixed(2)}</span>}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 12, color: "#b3ab9e", lineHeight: 1.6 }}>
        Listed by the official source, checked {checked}. A code being listed isn't a guarantee it works at checkout.
      </p>
    </main>
  );
}
