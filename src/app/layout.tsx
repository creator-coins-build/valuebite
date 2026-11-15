import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import TabBar from "../components/TabBar";

export const metadata: Metadata = {
  title: "ValueBite",
  description: "Put in your ZIP, see the best food deals near you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, fontFamily: "Nunito, system-ui, -apple-system, sans-serif", background: "#f7f4ef", color: "#191512" }}>
        <div style={{ paddingBottom: 64 }}>{children}</div>
        <Suspense fallback={null}><TabBar /></Suspense>
      </body>
    </html>
  );
}
