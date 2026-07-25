import { Badge, type BadgeTone } from "@/components/ui/badge";
import { describeProjectStatus, isProjectStatus } from "@/lib/schemas/projects";

/**
 * A project's status, as a word first and a colour second.
 *
 * Colour stays rationed: only `blocked` and `done` carry any, because only they
 * mean something a reader must act on or can stop thinking about. Active and
 * paused are ordinary states and are shown in ordinary ink.
 *
 * An unrecognised status is displayed rather than hidden — the record outranks
 * the interface's vocabulary, exactly as it does in the audit trail.
 */
const TONES: Record<string, BadgeTone> = {
  active: "neutral",
  paused: "neutral",
  blocked: "attention",
  done: "confirmed",
  abandoned: "neutral",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <Badge tone={TONES[status] ?? "neutral"}>
      {describeProjectStatus(status)}
      {isProjectStatus(status) ? null : " (unrecognised)"}
    </Badge>
  );
}
