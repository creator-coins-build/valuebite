import React from "react";

/** Real app icons, served locally from /public/icons (official App Store artwork). */
export const BRANDS: Record<string, { initials: string; bg: string; fg: string; name: string; appStoreUrl: string }> = {
  "taco-bell": { initials: "TB", bg: "#702082", fg: "#fff", name: "Taco Bell", appStoreUrl: "https://apps.apple.com/us/app/taco-bell-fast-food-delivery/id497387361" },
  dominos: { initials: "D", bg: "#006491", fg: "#fff", name: "Domino's", appStoreUrl: "https://apps.apple.com/us/app/dominos-pizza-usa/id436491861" },
  "chick-fil-a": { initials: "CFA", bg: "#e51636", fg: "#fff", name: "Chick-fil-A", appStoreUrl: "https://apps.apple.com/us/app/chick-fil-a/id488818252" },
  "burger-king": { initials: "BK", bg: "#f5ebdc", fg: "#d62300", name: "Burger King", appStoreUrl: "https://apps.apple.com/us/app/burger-king-app/id638323895" },
  chipotle: { initials: "C", bg: "#a81612", fg: "#fff", name: "Chipotle", appStoreUrl: "https://apps.apple.com/us/app/chipotle/id327228455" },
};

export function brandSlugFor(restaurantName: string): string {
  return Object.keys(BRANDS).find((k) => BRANDS[k]!.name === restaurantName) ?? "dominos";
}

/** Taco Bell's CDN blocks hotlinks, so their photos go through our proxy. */
export function imgSrc(url: string): string {
  return `/api/img?u=${encodeURIComponent(url)}`;
}

/** TB publishes a wide 750x340 hero crop alongside the 269x269 square - same URL, different suffix. */
export function wideSrc(url: string): string {
  return imgSrc(url.replace("269x269", "750x340"));
}

export function BrandIcon({ slug, size = 40 }: { slug: string; size?: number }) {
  const b = BRANDS[slug];
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: size * 0.24,
    border: "1px solid rgba(0,0,0,0.08)", flexShrink: 0, objectFit: "cover",
  };
  if (b) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/icons/${slug}.png`} alt={b.name} width={size} height={size} style={style} loading="lazy" />;
  }
  return (
    <span style={{ ...style, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#f1ece4", color: "#191512", fontWeight: 800, fontSize: size * 0.3 }}>
      {slug.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** Shared light card (Popeyes-style warm white). */
export const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 24,
  border: "1px solid #efe9e1",
  boxShadow: "0 2px 12px rgba(90,60,20,0.06)",
};

export const ORANGE = "#f26722";
export const ORANGE_TEXT = "#e85d10";
export const ORANGE_SOFT = "rgba(242,103,34,0.12)";
export const MUTED = "#7a7268";
export const INK = "#191512";
