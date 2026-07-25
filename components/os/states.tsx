import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * The honest-state vocabulary.
 *
 * Every surface in ASI OS renders exactly one of these, and never anything else:
 *
 *   ready         — real data, from a real record
 *   calm          — nothing needs you, stated with confidence
 *   nothingYet    — never used, with one concrete first step
 *   notConfigured — a prerequisite is missing, named precisely
 *   failed        — something broke: what, what it means, what to do
 *   loading       — skeletons that match the final layout
 *
 * There is deliberately no component for a placeholder value, a sample metric, or
 * a "coming soon" panel. A number that is not real must not appear, and a feature
 * that does not exist must not be advertised. If a surface cannot be one of the
 * states above, it is not ready to ship.
 */

function Frame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-card border border-line",
        "bg-surface px-5 py-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Nothing needs you. This is the product working, not the product empty, so it
 * is stated with confidence rather than apology.
 */
export function CalmState({
  headline,
  detail,
}: {
  headline: string;
  detail?: ReactNode;
}) {
  return (
    <Frame className="border-confirmed/20">
      <p className="text-sm text-ink">{headline}</p>
      {detail ? <p className="text-sm text-ink-muted">{detail}</p> : null}
    </Frame>
  );
}

/**
 * A surface that has never been used. Offers exactly one concrete next step
 * rather than a tour of features that do not exist yet.
 */
export function NothingYet({
  headline,
  detail,
  action,
}: {
  headline: string;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Frame>
      <p className="text-sm text-ink">{headline}</p>
      {detail ? <p className="text-sm text-ink-muted">{detail}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Frame>
  );
}

/**
 * A prerequisite is missing. Names the exact variables rather than saying
 * "something went wrong", because a vague error costs the reader the diagnosis.
 */
export function NotConfigured({
  headline = "ASI OS is not configured",
  missing,
  detail,
}: {
  headline?: string;
  missing: string[];
  detail?: ReactNode;
}) {
  return (
    <Frame className="border-attention/25">
      <p className="text-sm text-ink">{headline}</p>
      {detail ? <p className="text-sm text-ink-muted">{detail}</p> : null}
      {missing.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {missing.map((name) => (
            <li key={name} className="font-mono text-xs text-attention">
              {name}
            </li>
          ))}
        </ul>
      ) : null}
    </Frame>
  );
}

/** Something failed. Says what, what it means, and what to do about it. */
export function Failed({
  headline = "Something failed",
  detail,
  action,
}: {
  headline?: string;
  detail?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Frame className="border-danger/25">
      <p className="text-sm text-ink">{headline}</p>
      {detail ? <p className="text-sm text-ink-muted">{detail}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </Frame>
  );
}

/**
 * A placeholder shaped like the content it will become. Never a zero and never a
 * dash, either of which could be misread as a real value.
 */
export function Skeleton({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      aria-busy="true"
      className={cn("animate-pulse rounded bg-raised", className)}
    />
  );
}
