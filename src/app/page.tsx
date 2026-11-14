import { openDb } from "../modules/db/client";
import { rankableRows, activeDeals } from "../modules/db/queries";
import { scorePopulation, rank as rankScores } from "../modules/scoring/engine";
import { entrees } from "../modules/scoring/rank";

export const dynamic = "force-dynamic";

const ZIP = "33613";

function priceLabel(pricingType: string): { text: string; color: string } {
  switch (pricingType) {
    case "exact_store":
      return { text: "Exact store price", color: "#3fb950" };
    case "zip_local":
      return { text: "Local estimate", color: "#d29922" };
    case "regional":
      return { text: "Regional estimate - may vary", color: "#d29922" };
    default:
      return { text: "Typical price - may vary", color: "#d29922" };
  }
}

export default async function Home() {
  const { db, client } = await openDb("./data/pgdb");
  const rows = await rankableRows(db, ZIP);
  const deals = await activeDeals(db);

  const scored = scorePopulation(
    rows.map((r) => ({ id: `${r.restaurantSlug}:${r.productId}`, price: r.price, calories: r.calories, protein: r.proteinG })),
  );
  const byId = new Map(rows.map((r) => [`${r.restaurantSlug}:${r.productId}`, r]));
  const withScores = rankScores(scored, "value")
    .map((s) => ({ s, row: byId.get(s.id)! }))
    .filter(({ row }) => row !== undefined);

  const entreeRows = entrees(rows.map((r) => ({ ...r, calories: r.calories, category: r.category ?? "" })));
  const entreeKeys = new Set(entreeRows.map((r) => `${r.restaurantSlug}:${r.productId}`));
  const entreeScored = withScores.filter(({ s }) => entreeKeys.has(s.id));

  const byValue = entreeScored.filter(({ s }) => s.valueScore !== null).slice(0, 20);
  const byCal = rankScores(scored.filter((s) => entreeKeys.has(s.id) && s.calPerDollar !== null), "calPerDollar")
    .slice(0, 20)
    .map((s) => ({ s, row: byId.get(s.id)! }));
  const cheapest = rankScores(scored.filter((s) => entreeKeys.has(s.id) && s.price !== null), "cheapest")
    .slice(0, 20)
    .map((s) => ({ s, row: byId.get(s.id)! }));

  await client.close();

  const table = (title: string, list: { s: (typeof withScores)[number]["s"]; row: (typeof rows)[number] }[], note: string) => (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{title}</h2>
      <p style={{ color: "#9aa0a6", fontSize: 13, marginTop: 0 }}>{note}</p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#9aa0a6", borderBottom: "1px solid #30363d" }}>
            <th style={{ padding: "6px 8px" }}>Item</th>
            <th style={{ padding: "6px 8px" }}>Restaurant</th>
            <th style={{ padding: "6px 8px" }}>Price</th>
            <th style={{ padding: "6px 8px" }}>Calories</th>
            <th style={{ padding: "6px 8px" }}>Protein</th>
            <th style={{ padding: "6px 8px" }}>cal/$</th>
            <th style={{ padding: "6px 8px" }}>Score</th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ s, row }) => {
            const pl = priceLabel(row.pricingType);
            return (
              <tr key={s.id} style={{ borderBottom: "1px solid #21262d" }}>
                <td style={{ padding: "8px" }}>{row.name}</td>
                <td style={{ padding: "8px", color: "#9aa0a6" }}>{row.restaurantName}</td>
                <td style={{ padding: "8px" }}>
                  ${row.price.toFixed(2)}{" "}
                  <span style={{ color: pl.color, fontSize: 11 }}>{pl.text}</span>
                </td>
                <td style={{ padding: "8px" }}>{row.calories ?? "unknown"}</td>
                <td style={{ padding: "8px" }}>{row.proteinG !== null ? `${row.proteinG}g` : <span style={{ color: "#9aa0a6" }}>unknown</span>}</td>
                <td style={{ padding: "8px" }}>{s.calPerDollar !== null ? Math.round(s.calPerDollar) : "-"}</td>
                <td style={{ padding: "8px", fontWeight: 700 }}>{s.valueScore !== null ? s.valueScore.toFixed(1) : "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px" }}>
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>ValueBite</h1>
      <p style={{ color: "#9aa0a6", marginTop: 0 }}>
        Best food value near ZIP {ZIP}. {rows.length} items from {new Set(rows.map((r) => r.restaurantSlug)).size} restaurants.
        Prices and nutrition carry their source and confidence - estimates are always labeled.
      </p>

      {table(
        "Best Value Score",
        byValue,
        "Value Score V1: 55% protein/$, 35% calories/$, 10% price. Only items with known protein get a score - protein is never guessed.",
      )}
      {table("Most calories per dollar", byCal, "Entrees only (no sauces, drinks, sides, sweets or party packs).")}
      {table("Cheapest entrees", cheapest, "Entrees only, sorted by price.")}

      <section>
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Official deals</h2>
        <p style={{ color: "#9aa0a6", fontSize: 13, marginTop: 0 }}>
          Listed by the restaurant's official ordering site. A code is shown only with its freshness evidence - last checked time and published expiry.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#9aa0a6", borderBottom: "1px solid #30363d" }}>
              <th style={{ padding: "6px 8px" }}>Deal</th>
              <th style={{ padding: "6px 8px" }}>Restaurant</th>
              <th style={{ padding: "6px 8px" }}>Code</th>
              <th style={{ padding: "6px 8px" }}>Price</th>
              <th style={{ padding: "6px 8px" }}>Expires</th>
              <th style={{ padding: "6px 8px" }}>Listed by official source, checked</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #21262d" }}>
                <td style={{ padding: "8px" }}>{d.title}</td>
                <td style={{ padding: "8px", color: "#9aa0a6" }}>{d.restaurantName}</td>
                <td style={{ padding: "8px", fontFamily: "monospace" }}>{d.promoCode ?? "-"}</td>
                <td style={{ padding: "8px" }}>{d.price !== null ? `$${d.price.toFixed(2)}` : "-"}</td>
                <td style={{ padding: "8px" }}>{d.expiresAt ? d.expiresAt.slice(0, 10) : "no expiry published"}</td>
                <td style={{ padding: "8px", color: "#9aa0a6", fontSize: 12 }}>{d.lastVerified.slice(0, 16).replace("T", " ")} UTC</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
