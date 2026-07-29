"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * Reveals a section once it is reached, and never hides it again.
 *
 * The visible flag is written straight onto the element rather than held in state:
 * scroll position is an external system, and a hundred sections becoming visible
 * should not be a hundred React renders.
 *
 * Entrance only, on purpose — content that fades out as it leaves is content the
 * reader cannot return to. The hidden state lives in CSS, so a visitor with
 * JavaScript disabled needs the `<noscript>` override on the page; without it the
 * page would be blank, which is the failure mode worth being explicit about.
 */
export function Reveal({
  children,
  className,
  /** Staggers siblings. Kept small; a queue of delays reads as a slow page. */
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const show = () => {
      node.dataset.visible = "true";
    };

    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          show();
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-visible="false"
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
      className={cn("reveal", className)}
    >
      {children}
    </div>
  );
}
