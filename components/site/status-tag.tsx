import { cn } from "@/components/ui/cn";
import { STATUS_LABEL, type Status } from "@/lib/site/landing";

/**
 * The honesty vocabulary, rendered. Every capability on the page carries one
 * of these, so a reader can always tell what runs from what is intended.
 * The status is written out — never colour alone — and set in mono because it
 * is a machine fact about the build.
 */
const TONES: Record<Status, { text: string; dot: string }> = {
  running: { text: "text-confirmed-ink", dot: "bg-confirmed-ink" },
  in_development: { text: "text-accent-ink", dot: "bg-accent-ink" },
  planned: { text: "text-mist", dot: "bg-edge-strong" },
  proposed: { text: "text-mist", dot: "bg-transparent outline outline-1 outline-edge-strong" },
};

export function StatusTag({
  status,
  label,
  className,
}: {
  status: Status;
  /** Overrides the default wording, e.g. "Design target — Phase 02". */
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] leading-4 tracking-tight",
        TONES[status].text,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", TONES[status].dot)} />
      {label ?? STATUS_LABEL[status]}
    </span>
  );
}
