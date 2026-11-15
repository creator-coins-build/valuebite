import offersData from "../../data/digital-offers.json";

/** Manual source review expires after 48h, independently of snapshot generation. */
export function currentDigitalOffers(now = Date.now()) {
  return offersData.offers.filter(o => {
    const age = now - Date.parse(o.checkedAt);
    return age >= 0 && age < 48 * 3600_000 && (!o.expiresAt || Date.parse(o.expiresAt) > now);
  });
}

