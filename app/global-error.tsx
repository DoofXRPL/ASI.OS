"use client";

import { useEffect } from "react";

/**
 * The last resort, used when the root layout itself fails. It cannot rely on the
 * application's styles or components, so everything here is self-contained.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    console.error("[asi] root layout failed", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#08090b",
          color: "#e8ebef",
          fontFamily: "system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "24rem" }}>
          <h1 style={{ fontSize: "1rem", fontWeight: 500 }}>
            ASI OS could not start
          </h1>
          <p style={{ color: "#98a1ac", fontSize: "0.875rem", lineHeight: 1.6 }}>
            Nothing was changed and no records were affected. Reload to try again.
            {error.digest ? ` Reference ${error.digest}.` : ""}
          </p>
        </main>
      </body>
    </html>
  );
}
