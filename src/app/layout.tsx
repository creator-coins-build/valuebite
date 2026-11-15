import type { Metadata } from "next";
import type { ReactNode } from "react";
import TabBar from "../components/TabBar";

export const metadata: Metadata = {
  title: "ValueBite",
  description: "Put in your ZIP, see the best food deals near you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#0e0d0b", color: "#f5f2ec" }}>
        <div style={{ paddingBottom: 64 }}>{children}</div>
        <TabBar />
      </body>
    </html>
  );
}
