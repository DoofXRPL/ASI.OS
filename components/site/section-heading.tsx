import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * The same three beats on every section: what this is, the claim, the
 * qualification. Machine facts stay in mono so they read as data rather than as
 * a slogan.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  className,
}: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", className)}>
      <p className="font-mono text-[11px] tracking-[0.24em] text-ink-faint uppercase">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-medium tracking-[-0.02em] text-balance text-ink md:text-3xl">
        {title}
      </h2>
      {lead ? (
        <p className="mt-4 text-sm/6 text-pretty text-ink-muted">{lead}</p>
      ) : null}
    </div>
  );
}
