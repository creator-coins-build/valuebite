/**
 * Phase 4: ZIP -> stores resolution.
 *
 * - ZIP -> lat/lon: zippopotam.us (free, no key).
 * - Domino's: official store-locator takes the ZIP directly.
 * - Taco Bell: official store service takes lat/lon.
 *
 * Every locator response is parsed defensively: a store without a usable
 * id/address is skipped, never guessed.
 */

export interface GeoPoint { lat: number; lon: number }
export interface ResolvedStore {
  restaurantSlug: string;
  storeId: string;
  address: string;
  zip: string;
  lat: number | null;
  lon: number | null;
  isOpen: boolean | null;
}

export function parseZipResponse(raw: any): (GeoPoint & { city: string; state: string }) | null {
  const place = raw?.places?.[0];
  const lat = Number(place?.latitude), lon = Number(place?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, city: String(place?.["place name"] ?? ""), state: String(place?.["state abbreviation"] ?? "") };
}

export async function zipToGeo(zip: string, fetchFn: typeof fetch = fetch): Promise<(GeoPoint & { city: string; state: string }) | null> {
  const res = await fetchFn(`https://api.zippopotam.us/us/${encodeURIComponent(zip)}`);
  if (!res.ok) return null;
  return parseZipResponse(await res.json());
}

export function parseDominosLocator(raw: any): ResolvedStore[] {
  const out: ResolvedStore[] = [];
  for (const s of raw?.Stores ?? []) {
    if (!s?.StoreID || !s?.Address?.Street) continue;
    const lat = Number(s?.StoreCoordinates?.StoreLatitude), lon = Number(s?.StoreCoordinates?.StoreLongitude);
    out.push({
      restaurantSlug: "dominos",
      storeId: String(s.StoreID),
      address: `${s.Address.Street}, ${s.Address.City}, ${s.Address.Region} ${s.Address.PostalCode}`,
      zip: String(s.Address.PostalCode ?? ""),
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      isOpen: typeof s?.IsOpen === "boolean" ? s.IsOpen : null,
    });
  }
  return out;
}

export function parseTacoBellLocator(raw: any): ResolvedStore[] {
  const out: ResolvedStore[] = [];
  for (const s of raw?.nearByStores ?? []) {
    if (!s?.storeNumber || !s?.address?.line1) continue;
    const lat = Number(s?.geoLocation?.latitude), lon = Number(s?.geoLocation?.longitude);
    out.push({
      restaurantSlug: "taco-bell",
      storeId: String(s.storeNumber),
      address: `${s.address.line1}, ${s.address.town}, ${s.address?.region?.isocode ?? ""} ${s.address.postalCode}`,
      zip: String(s.address.postalCode ?? ""),
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      isOpen: typeof s?.storeStatus === "string" ? s.storeStatus !== "closed" : null,
    });
  }
  return out;
}

export const LOCATOR_URLS = {
  dominos: (zip: string) => `https://order.dominos.com/power/store-locator?c=${encodeURIComponent(zip)}&type=Carryout`,
  tacobell: (lat: number, lon: number) =>
    `https://www.tacobell.com/tacobellwebservices/v4/tacobell/stores?latitude=${lat}&longitude=${lon}`,
};

/** Resolve all supported chains' stores for a ZIP. Per-chain failures degrade to an empty list, never throw. */
export async function resolveStores(zip: string, fetchFn: typeof fetch = fetch): Promise<Record<string, ResolvedStore[]>> {
  const out: Record<string, ResolvedStore[]> = { dominos: [], "taco-bell": [] };
  const geo = await zipToGeo(zip, fetchFn);
  try {
    const res = await fetchFn(LOCATOR_URLS.dominos(zip));
    if (res.ok) out.dominos = parseDominosLocator(await res.json());
  } catch { /* degrade */ }
  if (geo) {
    try {
      const res = await fetchFn(LOCATOR_URLS.tacobell(geo.lat, geo.lon));
      if (res.ok) out["taco-bell"] = parseTacoBellLocator(await res.json());
    } catch { /* degrade */ }
  }
  return out;
}
