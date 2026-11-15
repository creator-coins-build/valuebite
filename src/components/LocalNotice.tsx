import { MUTED } from "./brand";

/**
 * Locality honesty line: which stores exact prices come from, which chains
 * failed for this ZIP, and an explicit notice when the requested ZIP could
 * not be loaded (never silent 33613 data under another ZIP's name).
 */
export function LocalNotice({ zip, requestedZip, fellBack, live, stores, liveErrors, compact = false }: {
  zip: string; requestedZip: string | null; fellBack: boolean; live: boolean;
  stores: { slug: string; address: string }[]; liveErrors: string[]; compact?: boolean;
}) {
  if (fellBack && requestedZip) {
    return <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#a13d10", fontWeight: 700, textAlign: "center" }}>
      couldn't load local prices for {requestedZip} - showing {zip} (USF Tampa) instead
    </p>;
  }
  if (!live) return null;
  return <>
    {stores.length > 0 && (
      <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED, textAlign: "center" }}>
        Local prices: Taco Bell + Domino's at {stores.map(s => s.address).join(" · ")}. Other chains: estimates (~).
      </p>
    )}
    {liveErrors.length > 0 && (
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#a13d10", textAlign: "center" }}>
        {liveErrors.map(e => e.split(":")[0]).join(", ")} unavailable for {requestedZip} right now
      </p>
    )}
  </>;
}
