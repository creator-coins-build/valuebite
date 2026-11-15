import Link from "next/link";
import { openDb } from "../../modules/db/client";
import { rankableRows, type RankableRow } from "../../modules/db/queries";
import { readSnapshot } from "../../modules/db/snapshot";
import { scorePopulation } from "../../modules/scoring/engine";
import type { ScoreResult } from "../../modules/scoring/types";

export const dynamic = "force-dynamic";

const ZIP = "33613";
const key = (r: RankableRow) => `${r.restaurantSlug}:${r.productId}`;

function metric(label: string, a: string, b: string, winner: "a" | "b" | "tie" | "na") {
  const style = (side: "a" | "b") => ({
    padding: "8px",
    fontWeight: winner === side ? 700 : 400,
    color: winner === side ? "#3fb950" : "#e8eaed",
  });
  return (
    <tr style={{ borderBottom: "1px solid #21262d" }}>
      <td style={style("a")}>{a}</td>
      <td style={{ padding: "8px", color: "#9aa0a6", textAlign: "center" }}>{label}</td>
      <td style={{ ...style("b"), textAlign: "right" }}>{b}</td>
    </tr>
  );
}

export default async function Compare({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const aKey = typeof params.a === "string" ? params.a : "";
  const bKey = typeof params.b === "string" ? params.b : "";

  const snap = readSnapshot();
  let rows;
  if (snap) {
    rows = snap.rows;
  } else {
    const { db, client } = await openDb("./data/pgdb");
    rows = await rankableRows(db, ZIP);
    await client.close();
  }

  // compare only entree-like, purchasable items to keep the pickers sane
  const options = rows.filter((r) => r.price > 0 && r.price < 40);
  const a = rows.find((r) => key(r) === aKey);
  const b = rows.find((r) => key(r) === bKey);

  let sa: ScoreResult | undefined, sb: ScoreResult | undefined;
  if (a && b) {
    // score within the full local population so scores are comparable to the homepage
    const scored = scorePopulation(rows.map((r) => ({ id: key(r), price: r.price, calories: r.calories, protein: r.proteinG })));
    sa = scored.find((s) => s.id === aKey);
    sb = scored.find((s) => s.id === bKey);
  }

  const priceNote = (r: RankableRow) =>
    r.pricingType === "exact_store" ? "exact store price" : "typical price - may vary";

  const cmp = (va: number | null, vb: number | null, better: "high" | "low"): "a" | "b" | "tie" | "na" => {
    if (va === null || vb === null) return "na";
    if (va === vb) return "tie";
    return better === "high" ? (va > vb ? "a" : "b") : (va < vb ? "a" : "b");
  };

  const select = (name: string, current: string) => (
    <select name={name} defaultValue={current} style={{ maxWidth: 320 }}>
      <option value="">choose an item</option>
      {options.map((r) => (
        <option key={key(r)} value={key(r)}>
          {r.restaurantName} - {r.name} (${r.price.toFixed(2)})
        </option>
      ))}
    </select>
  );

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 20px" }}>
      <p style={{ fontSize: 13 }}><Link href="/" style={{ color: "#58a6ff" }}>&larr; rankings</Link></p>
      <h1 style={{ fontSize: 26 }}>Compare items</h1>
      <form method="get" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 28, padding: 14, background: "#161b22", borderRadius: 8 }}>
        {select("a", aKey)}
        <span style={{ color: "#9aa0a6" }}>vs</span>
        {select("b", bKey)}
        <button type="submit" style={{ padding: "4px 14px" }}>Compare</button>
      </form>

      {a && b && sa && sb ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #30363d", textAlign: "left" }}>
              <th style={{ padding: "8px", width: "40%" }}>{a.name}<div style={{ color: "#9aa0a6", fontSize: 12, fontWeight: 400 }}>{a.restaurantName}</div></th>
              <th style={{ padding: "8px", width: "20%" }}></th>
              <th style={{ padding: "8px", width: "40%", textAlign: "right" }}>{b.name}<div style={{ color: "#9aa0a6", fontSize: 12, fontWeight: 400 }}>{b.restaurantName}</div></th>
            </tr>
          </thead>
          <tbody>
            {metric(`price`, `$${a.price.toFixed(2)} (${priceNote(a)})`, `$${b.price.toFixed(2)} (${priceNote(b)})`, cmp(a.price, b.price, "low"))}
            {metric("calories", a.calories !== null ? String(a.calories) : "unknown", b.calories !== null ? String(b.calories) : "unknown", cmp(a.calories, b.calories, "high"))}
            {metric("protein", a.proteinG !== null ? `${a.proteinG}g` : "unknown", b.proteinG !== null ? `${b.proteinG}g` : "unknown", cmp(a.proteinG, b.proteinG, "high"))}
            {metric("calories per $", sa.calPerDollar !== null ? String(Math.round(sa.calPerDollar)) : "unknown", sb.calPerDollar !== null ? String(Math.round(sb.calPerDollar)) : "unknown", cmp(sa.calPerDollar, sb.calPerDollar, "high"))}
            {metric("protein per $", sa.proteinPerDollar !== null ? `${sa.proteinPerDollar.toFixed(1)}g` : "unknown", sb.proteinPerDollar !== null ? `${sb.proteinPerDollar.toFixed(1)}g` : "unknown", cmp(sa.proteinPerDollar, sb.proteinPerDollar, "high"))}
            {metric("Value Score", sa.valueScore !== null ? sa.valueScore.toFixed(1) : "no score (protein unknown)", sb.valueScore !== null ? sb.valueScore.toFixed(1) : "no score (protein unknown)", cmp(sa.valueScore, sb.valueScore, "high"))}
          </tbody>
        </table>
      ) : (
        <p style={{ color: "#9aa0a6" }}>Pick two items to compare. Prices keep their honesty labels; unknown nutrition is shown as unknown, never as 0.</p>
      )}
    </main>
  );
}
