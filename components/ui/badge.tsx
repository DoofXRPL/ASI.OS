import type { ReactNode } from "react";
import { cn } from "./cn";

/**
 * Tones map to meaning, never to decoration:
 * neutral is information, attention needs a human, confirmed is settled,
 * danger failed, and thinking is the system working.
 */
export type BadgeTone = "neutral" | "attention" | "confirmed" | "danger" | "thinking";

const TONES: Record<BadgeTone, string> = {
  neutral: "border-line-strong text-ink-muted",
  attention: "border-attention/40 bg-attention-dim text-attention",
  confirmed: "border-confirmed/40 bg-confirmed-dim text-confirmed",
  danger: "border-danger/40 bg-danger-dim text-danger",
  thinking: "border-accent/40 bg-accent-dim text-accent",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
        "font-mono text-[11px] leading-4 tracking-tight",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusDot({ tone = "neutral" }: { tone?: BadgeTone }) {
  const colour: Record<BadgeTone, string> = {
    neutral: "bg-ink-faint",
    attention: "bg-attention",
    confirmed: "bg-confirmed",
    danger: "bg-danger",
    thinking: "bg-accent",
  };
  return (
    <span
      aria-hidden="true"
      className={cn("size-1.5 shrink-0 rounded-full", colour[tone])}
    />
  );
}
