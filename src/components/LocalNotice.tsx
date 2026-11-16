import { MUTED } from "./brand";

/**
 * Locality honesty line: which stores exact prices come from, which chains
 * failed for this ZIP, and an explicit notice when the requested ZIP could
 * not be loaded (never silent 33613 data under another ZIP's name).
 * Stores carrying asOf come from a dated browser-captured snapshot, not a
 * live fetch - the freshness date is shown, never implied current.
 */
const CHAIN_NAMES: Record<string, string> = {
  "taco-bell": "Taco Bell",
  dominos: "Domino's",
  papajohns: "Papa John's",
  pizzahut: "Pizza Hut",
  sonic: "Sonic",
};

export function LocalNotice({ zip, requestedZip, fellBack, live, stores, liveErrors, compact = false }: {
  zip: string; requestedZip: string | null; fellBack: boolean; live: boolean;
  stores: { slug: string; address: string; asOf?: string }[]; liveErrors: string[]; compact?: boolean;
}) {
  if (fellBack && requestedZip) {
    return <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#a13d10", fontWeight: 700, textAlign: "center" }}>
      couldn't load local prices for {requestedZip} - showing {zip} (USF Tampa) instead
    </p>;
  }
  if (!live && stores.length === 0) return null;
  const liveStores = stores.filter((s) => !s.asOf);
  const sampledStores = stores.filter((s) => s.asOf);
  return <>
    {liveStores.length > 0 && (
      <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED, textAlign: "center" }}>
        Local prices: {liveStores.map((s) => CHAIN_NAMES[s.slug] ?? s.slug).join(" + ")} at {liveStores.map((s) => s.address).join(" · ")}. Chick-fil-A, Burger King + Chipotle: estimates (~).
      </p>
    )}
    {sampledStores.map((s) => (
      <p key={s.slug} style={{ margin: "4px 0 0", fontSize: 11, color: MUTED, textAlign: "center" }}>
        {CHAIN_NAMES[s.slug] ?? s.slug}: exact prices at {s.address}, sampled {s.asOf}.
      </p>
    ))}
    {liveErrors.length > 0 && (
      <>
        {liveErrors.map((e) => {
          if (e.includes("no local snapshot")) {
            const name = e.split(":")[0];
            const coverage = (e.match(/covered ZIPs: (.+)$/)?.[1] ?? "").trim();
            return (
              <p key={e} style={{ margin: "4px 0 0", fontSize: 11, color: "#a13d10", textAlign: "center" }}>
                {name} has no saved store sample for {requestedZip}.{coverage && coverage !== "none" ? ` Its current coverage is ZIP ${coverage} only.` : ""}
              </p>
            );
          }
          return null;
        })}
        {liveErrors.some((e) => !e.includes("no local snapshot")) && (
          <p style={{ margin: "4px 0 0", fontSize: 11, color: "#a13d10", textAlign: "center" }}>
            {liveErrors.filter((e) => !e.includes("no local snapshot")).map((e) => e.split(":")[0]).join(", ")} unavailable for {requestedZip} right now
          </p>
        )}
      </>
    )}
  </>;
}
