import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ASI OS",
    template: "%s · ASI OS",
  },
  description:
    "Adaptive Systems Interface — a private personal intelligence and coordination layer.",
  // A private system has no business being indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#08090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The attribute tells Next.js the smooth scrolling is deliberate, so it can
    // suppress it during route transitions instead of warning about it.
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
