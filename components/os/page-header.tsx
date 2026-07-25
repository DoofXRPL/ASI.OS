import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { LoopStage } from "./nav";

/**
 * Every surface states which part of the loop it serves.
 *
 * This is not ornament. Observe, Understand, Recommend, Approve, Act, Remember is
 * the product, and a page that cannot name its stage has not earned its place in
 * the navigation.
 */
export function PageHeader({
  title,
  stage,
  purpose,
  actions,
}: {
  title: string;
  stage: LoopStage;
  purpose: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-base font-medium text-ink">{title}</h1>
          <Badge tone="neutral" className="uppercase">
            {stage}
          </Badge>
        </div>
        <p className="max-w-2xl text-sm text-ink-muted">{purpose}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
