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
  /*
   * The on-screen keyboard shrinks the page rather than sliding over it. The
   * default resizes only the visual viewport, which leaves a bottom-anchored
   * fixed element — the capture sheet — sitting behind the keyboard with its
   * Capture button out of reach. This is also what makes `dvh` answer to the
   * keyboard, so `max-height: 85dvh` on the sheet means what it says.
   */
  interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
