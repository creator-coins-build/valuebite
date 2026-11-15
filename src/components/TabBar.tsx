"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function TrophyIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4a1 1 0 0 0-1 1c0 2 1.5 3.5 4 3.5M17 6h3a1 1 0 0 1 1 1c0 2-1.5 3.5-4 3.5" />
    </svg>
  );
}
function SearchIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
function TicketIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6Z" />
      <path d="M13 5v2M13 11v2M13 17v2" />
    </svg>
  );
}
function PersonIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}

export default function TabBar() {
  const pathname = usePathname();
  const tabs = [
    { href: "/", label: "Home", Icon: HomeIcon },
    { href: "/top", label: "Top", Icon: TrophyIcon },
    { href: "/search", label: "Search", Icon: SearchIcon },
    { href: "/codes", label: "Codes", Icon: TicketIcon },
    { href: "/profile", label: "Profile", Icon: PersonIcon },
  ];
  return (
    <nav
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(255,255,255,0.97)", backdropFilter: "blur(8px)",
        borderTop: "1px solid #efe9e1", display: "flex", justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", width: "100%", maxWidth: 560 }}>
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          const color = active ? "#f26722" : "#9a9186";
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "8px 0 10px", textDecoration: "none", color,
                fontSize: 10.5, fontWeight: active ? 700 : 500,
              }}
            >
              <Icon color={color} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
