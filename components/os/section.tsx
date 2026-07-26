import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * A titled region of a surface.
 *
 * A section exists only when it has something to say: pass `empty` for the
 * designed state, or render nothing at all from the page when the section has
 * no reason to appear. That conditional composition is how a surface reflects
 * whether real work exists rather than presenting a fixed template with holes
 * in it.
 *
 * `count` is rendered in mono, inline with the heading, because a count is a
 * machine fact about your records — never a metric on display.
 */
export function Section({
  title,
  description,
  count,
  actions,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-medium text-ink">{title}</h2>
          {count !== undefined ? (
            <span className="font-mono text-[11px] text-ink-faint">{count}</span>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {description ? (
        <p className="max-w-measure text-xs text-ink-muted">{description}</p>
      ) : null}
      {children}
    </section>
  );
}
