import Link from "next/link";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Disclosure } from "@/components/ui/disclosure";
import { cn } from "@/components/ui/cn";
import type { AttentionItem, AttentionReason } from "@/lib/derive/attention";

/**
 * The things that honestly need a person.
 *
 * Each item is one line until asked. Behind the disclosure sits the whole of
 * why it is here: the detail in your own words where there is one, what would
 * move it, and a link to the record it was derived from. Nothing is shown that
 * does not point at something real.
 *
 * Colour is carried on a hairline rail and never as a fill, and every rail is
 * paired with a word, so the meaning survives being unable to see the colour.
 */
const REASON_LABELS: Record<AttentionReason, string> = {
  blocked: "blocked",
  no_next_action: "no next action",
  unprocessed_captures: "waiting",
  stale: "untouched",
};

const REASON_TONES: Record<AttentionReason, BadgeTone> = {
  blocked: "attention",
  no_next_action: "attention",
  unprocessed_captures: "neutral",
  stale: "neutral",
};

const REASON_RAILS: Record<AttentionReason, string> = {
  blocked: "border-attention",
  no_next_action: "border-attention",
  unprocessed_captures: "border-line-strong",
  stale: "border-line-strong",
};

export function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn("border-l-2 pl-4", REASON_RAILS[item.reason])}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="min-w-0 text-sm text-ink">
              <Link href={item.href} className="hover:underline">
                {item.headline}
              </Link>
            </h3>
            <Badge tone={REASON_TONES[item.reason]}>
              {REASON_LABELS[item.reason]}
            </Badge>
          </div>

          <Disclosure summary="Why this is here" className="mt-1.5">
            <p className="max-w-measure text-sm text-ink-muted">{item.detail}</p>
            <p className="max-w-measure text-xs text-ink-faint">
              {item.suggestedAction}
            </p>
            <p className="text-xs text-ink-faint">
              Derived from{" "}
              <Link href={item.href} className="text-accent hover:underline">
                {item.evidence.label}
              </Link>
              <span className="font-mono"> · {item.evidence.type}</span>
            </p>
          </Disclosure>
        </li>
      ))}
    </ul>
  );
}
