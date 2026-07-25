"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Failed } from "@/components/os/states";

/**
 * The failure state for private surfaces.
 *
 * It says what happened and offers a way forward. It deliberately does not show
 * the raw error message: in a system that holds personal records, an unfiltered
 * error can leak a record's contents into the interface. The digest is shown
 * instead so a specific failure can still be found in the server logs.
 */
export default function OsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[asi] surface failed", error);
  }, [error]);

  return (
    <Failed
      headline="This surface could not be loaded."
      detail={
        <>
          Nothing was changed. Your records are unaffected.
          {error.digest ? (
            <>
              {" "}
              Reference{" "}
              <span className="font-mono text-xs text-ink-faint">
                {error.digest}
              </span>
              .
            </>
          ) : null}
        </>
      }
      action={
        <Button variant="secondary" size="sm" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
