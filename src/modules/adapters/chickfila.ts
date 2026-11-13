/**
 * Chick-fil-A nutrition adapter.
 *
 * Source: https://www.chick-fil-a.com/nutrition-allergens
 * The official nutrition page embeds one JSON object per menu item directly in
 * the HTML: {"ID":38480,"title":"...","link":"...","sub_items":[...],
 * "fields":[{"label":"Calories","value":910},{"label":"Protein (g)","value":38},...]}.
 *
 * This is nutrition ONLY: Chick-fil-A publishes no public per-store price feed.
 * Prices must come from a labeled fallback level (see docs/data-sources.md and
 * the pricing fallback ladder) - never presented as exact.
 *
 * Extraction is brace-balanced (not regex-to-JSON) because nested objects like
 * sub_items make a naive regex capture unreliable.
 */

export interface CfaNutritionItem {
  id: string;
  title: string;
  link: string | null;
  calories: number | null;
  proteinG: number | null;
  /** Every labeled field as found on the page, for future use (fat, sodium, ...). */
  fields: Record<string, number | string>;
}

const START = /\{"ID":(\d+),"title":"/g;

/** Yield the raw text of every top-level {"ID":...} object embedded in the page. */
export function* extractEmbeddedObjects(html: string): Generator<string> {
  START.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = START.exec(html)) !== null) {
    const start = m.index;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < html.length; i++) {
      const c = html[i]!;
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          yield html.slice(start, i + 1);
          break;
        }
      }
    }
  }
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Parse all embedded nutrition objects. Unparseable objects are skipped, never guessed. */
export function parseNutritionHtml(html: string): CfaNutritionItem[] {
  const out: CfaNutritionItem[] = [];
  const seen = new Set<string>();
  for (const raw of extractEmbeddedObjects(html)) {
    let obj: any;
    try {
      obj = JSON.parse(raw);
    } catch {
      continue; // truncated or non-item JSON: skip, never guess
    }
    if (typeof obj?.ID !== "number" || typeof obj?.title !== "string" || !Array.isArray(obj?.fields)) continue;
    const id = String(obj.ID);
    if (seen.has(id)) continue;
    seen.add(id);
    const fields: Record<string, number | string> = {};
    for (const f of obj.fields) {
      if (typeof f?.label === "string") fields[f.label] = f.value;
    }
    out.push({
      id,
      title: obj.title,
      link: typeof obj.link === "string" ? obj.link : null,
      calories: num(fields["Calories"]),
      proteinG: num(fields["Protein (g)"]),
      fields,
    });
  }
  return out;
}

export const CFA_NUTRITION_URL = "https://www.chick-fil-a.com/nutrition-allergens";

export async function fetchNutrition(fetchFn: typeof fetch = fetch): Promise<CfaNutritionItem[]> {
  const res = await fetchFn(CFA_NUTRITION_URL, {
    headers: { "user-agent": "ValueBiteBot/0.1 (+contact owner)" },
  });
  if (!res.ok) throw new Error(`chick-fil-a nutrition page ${res.status}`);
  return parseNutritionHtml(await res.text());
}
