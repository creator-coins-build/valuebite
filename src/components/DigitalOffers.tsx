import offersData from "../../data/digital-offers.json";
import { BRANDS, BrandIcon, card, ORANGE, MUTED, INK } from "./brand";

import { currentDigitalOffers } from "../modules/digital-offers";

export function DigitalOffers({ restaurant = "" }: { restaurant?: string }) {
  const offers = currentDigitalOffers().filter(o => !restaurant || o.restaurantSlug === restaurant);
  return <section style={{ marginBottom: 26 }}>
    <h2 style={{ fontSize: 24, margin: "0 0 3px", fontWeight: 900, letterSpacing: -0.6 }}>Unlock better deals</h2>
    <p style={{ margin: "0 0 12px", fontSize: 13, color: MUTED }}>A little extra from your favorite apps.</p>
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory" }}>
      {offers.map(o => <article key={o.id} style={{ ...card, flex: "0 0 86%", boxSizing: "border-box", padding: 18, scrollSnapAlign: "start", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <BrandIcon slug={o.restaurantSlug} size={40} />
          <span style={{ background: "#191512", color: "white", borderRadius: 999, padding: "4px 10px", fontSize: 11, fontWeight: 800 }}>{o.appOnly ? "In app only" : o.channel}</span>
        </div>
        <h3 style={{ color: INK, fontSize: 21, lineHeight: 1.12, letterSpacing: -0.4, margin: "14px 0 8px", fontWeight: 900 }}>{o.title}</h3>
        <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 800, color: "#a13d10" }}>{o.eligibility}</p>
        <ol style={{ margin: "0 0 12px", paddingLeft: 20, fontSize: 12.5, color: INK, lineHeight: 1.55 }}>
          {o.steps.map((s, i) => <li key={i} style={{ marginBottom: 3 }}>{s}</li>)}
        </ol>
        <details style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}><summary style={{ cursor: "pointer" }}>Fine print</summary><p style={{ lineHeight: 1.5 }}>{o.terms}</p><a href={o.sourceUrl} style={{ color: MUTED }}>Official source</a> · checked {o.checkedAt.slice(0,10)}</details>
        <div style={{ marginTop: "auto" }}>
          <a href={o.ctaUrl === "__APPSTORE__" ? BRANDS[o.restaurantSlug]!.appStoreUrl : o.ctaUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", background: ORANGE, color: "white", borderRadius: 999, padding: "10px 14px", fontSize: 14, fontWeight: 900, textDecoration: "none" }}>{o.ctaLabel}</a>
          {o.ctaUrl !== "__APPSTORE__" && (
            <a href={BRANDS[o.restaurantSlug]!.appStoreUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 12, color: MUTED }}>Get the {BRANDS[o.restaurantSlug]!.name} app</a>
          )}
        </div>
      </article>)}
    </div>
    {offers.length === 0 && <p style={{ color: MUTED, fontSize: 13 }}>No confirmed digital offers here right now.</p>}
    <details style={{ marginTop: 8, fontSize: 12, color: MUTED }}><summary style={{ cursor: "pointer" }}>Coverage across all 5 restaurants</summary>
      <ul style={{ paddingLeft: 18, lineHeight: 1.5 }}>{offersData.coverage.map(c => <li key={c.slug}><strong>{BRANDS[c.slug]!.name}:</strong> {c.status}</li>)}</ul>
      <p>No currently confirmed app-only offer is listed. App + online and account-based rewards are labeled separately. Offers can vary by account and restaurant; confirm availability in the restaurant's app.</p>
    </details>
  </section>;
}
