import React from "react";

/** Real app icons, served locally from /public/icons (official App Store artwork). */
export const BRANDS: Record<string, { initials: string; bg: string; fg: string; name: string }> = {
  "taco-bell": { initials: "TB", bg: "#702082", fg: "#fff", name: "Taco Bell" },
  dominos: { initials: "D", bg: "#006491", fg: "#fff", name: "Domino's" },
  "chick-fil-a": { initials: "CFA", bg: "#e51636", fg: "#fff", name: "Chick-fil-A" },
  "burger-king": { initials: "BK", bg: "#f5ebdc", fg: "#d62300", name: "Burger King" },
  chipotle: { initials: "C", bg: "#a81612", fg: "#fff", name: "Chipotle" },
};

export function brandName(slug: string): string {
  return BRANDS[slug]?.name ?? slug;
}

export function brandSlugFor(restaurantName: string): string {
  return Object.keys(BRANDS).find((k) => BRANDS[k]!.name === restaurantName) ?? "dominos";
}

/** Taco Bell's CDN blocks hotlinks, so their photos go through our proxy. */
export function imgSrc(url: string): string {
  return `/api/img?u=${encodeURIComponent(url)}`;
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
    <span style={{ ...style, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#eee9e2", color: "#1c1c1e", fontWeight: 800, fontSize: size * 0.3 }}>
      {slug.slice(0, 2).toUpperCase()}
    </span>
  );
}

export const card: React.CSSProperties = {
  background: "#fff",
  borderRadius: 22,
  border: "1px solid #f0ebe3",
  boxShadow: "0 2px 10px rgba(60,40,20,0.05)",
};
