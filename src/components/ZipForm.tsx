import { card, ORANGE, INK } from "./brand";

/** Tiny ZIP switcher. GET form: carries ?zip= across pages (TabBar preserves it). */
export function ZipForm({ zip, action = "/" }: { zip: string; action?: string }) {
  return (
    <form method="get" action={action} style={{ ...card, borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 4px 4px 12px" }}>
      <span style={{ fontSize: 12, color: INK, fontWeight: 700 }}>near</span>
      <input
        name="zip" inputMode="numeric" pattern="\\d{5}" maxLength={5} defaultValue={zip}
        style={{ border: "none", outline: "none", fontSize: 13, width: 52, background: "transparent", color: INK, fontFamily: "inherit", fontWeight: 700 }}
      />
      <button type="submit" style={{ background: ORANGE, color: "#fff", border: "none", borderRadius: 999, padding: "5px 12px", fontWeight: 800, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
        set
      </button>
    </form>
  );
}
