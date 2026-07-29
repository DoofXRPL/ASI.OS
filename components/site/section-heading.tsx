import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * The same three beats on every section: what this is, the claim, the
 * qualification. Machine facts stay in mono so they read as data rather than
 * as a slogan. Left-aligned by design — this page is a technical document,
 * not a stage.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  aside,
  className,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  /** A status tag or metadata rendered on the eyebrow line. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
          {eyebrow}
        </p>
        {aside}
      </div>
      <h2 className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-balance text-carbon md:text-[2rem] md:leading-[1.15]">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-[15px]/6 text-pretty text-graphite">{lead}</p>
      ) : null}
    </div>
  );
}
