"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function TagIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41 11 3H4v7l9.59 9.59a2 2 0 0 0 2.83 0l4.17-4.17a2 2 0 0 0 0-2.83Z" />
      <circle cx="7.5" cy="6.5" r="1" fill={color} stroke="none" />
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

export default function TabBar() {
  const pathname = usePathname();
  const tabs = [
    { href: "/", label: "Deals", Icon: TagIcon },
    { href: "/codes", label: "Codes", Icon: TicketIcon },
  ];
  return (
    <nav
      style={{
        position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(255,255,255,0.96)", backdropFilter: "blur(8px)",
        borderTop: "1px solid #f0ebe3", display: "flex", justifyContent: "center",
      }}
    >
      <div style={{ display: "flex", width: "100%", maxWidth: 480 }}>
        {tabs.map(({ href, label, Icon }) => {
          const active = pathname === href;
          const color = active ? "#06c167" : "#8a8378";
          return (
            <Link
              key={href}
              href={href}
              style={{
                flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                padding: "8px 0 10px", textDecoration: "none", color,
                fontSize: 11, fontWeight: active ? 700 : 500,
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
