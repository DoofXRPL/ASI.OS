import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * One line by default; the reasoning on request.
 *
 * Built on native `<details>` and `<summary>`, which means it opens with the
 * keyboard, announces its expanded state to assistive technology, and works
 * with JavaScript disabled — none of which a hand-rolled toggle gets for free.
 * The only custom part is the marker.
 */
export function Disclosure({
  summary,
  children,
  className,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className={cn("group", className)} open={defaultOpen}>
      <summary
        className={cn(
          "inline-flex items-center gap-1.5 rounded text-xs text-ink-muted",
          "transition-colors duration-150 hover:text-ink",
        )}
      >
        <span
          aria-hidden="true"
          className="text-[9px] leading-none transition-transform duration-150 group-open:rotate-90"
        >
          ▶
        </span>
        {summary}
      </summary>
      <div className="mt-2 space-y-1.5">{children}</div>
    </details>
  );
}
