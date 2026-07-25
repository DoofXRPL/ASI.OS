import type { ReactNode } from "react";
import { cn } from "./cn";

type Tone = "info" | "attention" | "danger" | "confirmed";

const TONES: Record<Tone, string> = {
  info: "border-accent/30 bg-accent-dim/40 text-ink",
  attention: "border-attention/30 bg-attention-dim/40 text-ink",
  danger: "border-danger/30 bg-danger-dim/40 text-ink",
  confirmed: "border-confirmed/30 bg-confirmed-dim/40 text-ink",
};

export function Alert({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-md border px-3.5 py-3 text-sm", TONES[tone])}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      <div className={cn("text-ink-muted", title && "mt-1")}>{children}</div>
    </div>
  );
}
