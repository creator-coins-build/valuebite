import Link from "next/link";
import { sql } from "drizzle-orm";
import { openDb } from "../../modules/db/client";
import { readSnapshot } from "../../modules/db/snapshot";

export const dynamic = "force-dynamic";
const STALE_HOURS = 48;

export default async function Admin() {
  const snap = readSnapshot();
  if (snap) {
    // Hosted snapshot mode: PGlite stays closed (512Mi memory budget).
    const generated = new Date(snap.generatedAt);
    const stale = Date.now() - generated.getTime() > STALE_HOURS * 3600_000;
    const cell = { padding: "8px", fontSize: 13 } as const;
    return (
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px" }}>
        <p style={{ fontSize: 13 }}><Link href="/" style={{ color: "#58a6ff" }}>&larr; rankings</Link></p>
        <h1 style={{ fontSize: 26 }}>Data admin</h1>
        <p style={{ color: stale ? "#d29922" : "#3fb950", fontSize: 14 }}>
          Snapshot mode (hosted): {snap.rows.length} items, {snap.deals.length} deals, generated {snap.generatedAt}
          {stale ? " - stale (>48h)" : " - fresh"}.
        </p>
        <p style={{ fontSize: 13, color: "#9aa0a6" }}>Refresh runs are tracked in the build pipeline, not on the hosted instance.</p>
      </main>
    );
  }
  const { db, client } = await openDb("./data/pgdb");

  const runs = (await db.execute(sql`
    SELECT adapter, kind, status, started_at, finished_at, items_updated, anomalies, error
    FROM data_refresh_runs ORDER BY started_at DESC LIMIT 30
  `)).rows as any[];

  const freshness = (await db.execute(sql`
    SELECT r.name, r.slug, max(p.fetched_at) AS newest_price, count(*)::int AS price_rows
    FROM price_records p JOIN menu_items m ON m.id = p.menu_item_id JOIN restaurants r ON r.id = m.restaurant_id
    GROUP BY 1, 2 ORDER BY 1
  `)).rows as any[];

  const dealFreshness = (await db.execute(sql`
    SELECT r.name, count(*)::int AS deals, max(d.last_verified) AS newest_check,
           count(*) FILTER (WHERE d.expires_at IS NOT NULL AND d.expires_at < now())::int AS expired
    FROM deals d JOIN restaurants r ON r.id = d.restaurant_id WHERE d.active GROUP BY 1
  `)).rows as any[];

  await client.close();

  const cell = { padding: "8px", fontSize: 13 } as const;
  const head = { padding: "6px 8px", textAlign: "left" as const, color: "#9aa0a6", borderBottom: "1px solid #30363d" };
  const statusColor = (s: string) => (s === "success" ? "#3fb950" : s === "quarantined" ? "#d29922" : "#f85149");

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "32px 20px" }}>
      <p style={{ fontSize: 13 }}><Link href="/" style={{ color: "#58a6ff" }}>&larr; rankings</Link></p>
      <h1 style={{ fontSize: 26 }}>Data admin</h1>

      <h2 style={{ fontSize: 18 }}>Source freshness</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 28 }}>
        <thead><tr><th style={head}>Restaurant</th><th style={head}>Price rows</th><th style={head}>Newest price</th><th style={head}>Age</th><th style={head}>Status</th></tr></thead>
        <tbody>
          {freshness.map((f) => {
            const ageH = (Date.now() - new Date(f.newest_price).getTime()) / 3.6e6;
            const stale = ageH > STALE_HOURS;
            return (
              <tr key={f.slug} style={{ borderBottom: "1px solid #21262d" }}>
                <td style={cell}>{f.name}</td>
                <td style={cell}>{f.price_rows}</td>
                <td style={cell}>{new Date(f.newest_price).toISOString().slice(0, 16).replace("T", " ")} UTC</td>
                <td style={cell}>{ageH < 1 ? "<1h" : `${ageH.toFixed(0)}h`}</td>
                <td style={{ ...cell, color: stale ? "#f85149" : "#3fb950" }}>{stale ? "STALE" : "fresh"}</td>
              </tr>
            );
          })}
          {dealFreshness.map((d) => (
            <tr key={d.name} style={{ borderBottom: "1px solid #21262d" }}>
              <td style={cell}>{d.name} deals</td>
              <td style={cell}>{d.deals}</td>
              <td style={cell}>checked {new Date(d.newest_check).toISOString().slice(0, 16).replace("T", " ")} UTC</td>
              <td style={cell} colSpan={2}>{d.expired > 0 ? <span style={{ color: "#d29922" }}>{d.expired} expired still active</span> : "no expired deals active"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: 18 }}>Refresh runs</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><th style={head}>Adapter</th><th style={head}>Kind</th><th style={head}>Status</th><th style={head}>Items</th><th style={head}>Started</th><th style={head}>Anomalies / error</th></tr></thead>
        <tbody>
          {runs.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #21262d" }}>
              <td style={cell}>{r.adapter}</td>
              <td style={cell}>{r.kind}</td>
              <td style={{ ...cell, color: statusColor(r.status) }}>{r.status}</td>
              <td style={cell}>{r.items_updated}</td>
              <td style={cell}>{new Date(r.started_at).toISOString().slice(0, 16).replace("T", " ")}</td>
              <td style={{ ...cell, color: "#9aa0a6" }}>{r.error ?? (r.anomalies ? JSON.stringify(r.anomalies) : "")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
