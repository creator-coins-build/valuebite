import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ValueBite",
  description: "Put in your ZIP, see the best food deals near you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif", background: "#0f1115", color: "#e8eaed" }}>
        {children}
      </body>
    </html>
  );
}
