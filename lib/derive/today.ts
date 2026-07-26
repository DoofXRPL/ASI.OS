import type { InboxItemRow, ProjectRow } from "@/lib/supabase/database.types";
import {
  deriveAttention,
  plural,
  type AttentionItem,
} from "./attention";
import { countProjects, pickResumable, type ProjectCounts } from "./projects";

/**
 * What Today can honestly say about your records right now.
 *
 * A pure function over real rows, so every sentence it produces can be tested
 * exhaustively without a database and can never drift away from the data it
 * describes.
 *
 * The rule it exists to enforce: every sentence returned here must be derivable
 * from `input`. Nothing is estimated, rounded up, or filled in.
 */

/**
 * How long an active project may sit untouched before Today mentions it.
 *
 * Two weeks is a judgement, not a measurement, which is exactly why it is one
 * named constant rather than a number scattered through the code.
 */
export const STALE_AFTER_DAYS = 14;

export interface TodayInput {
  projects: ProjectRow[];
  /** Unprocessed captures the caller owns. */
  unprocessed: InboxItemRow[];
  /** Unprocessed captures that exist, even if fewer rows were passed. */
  unprocessedTotal: number;
  /** Captures in any state, used only to tell "never used" from "all clear". */
  capturesTotal: number;
  now?: Date;
  staleAfterDays?: number;
}

export interface TodayState {
  /** One sentence describing the shape of things, composed only from counts. */
  headline: string;
  attention: AttentionItem[];
  /** Work that is easiest to resume, when it is not already asking for you. */
  resume: ProjectRow | null;
  /** Nothing needs you, and there are records for that to be true of. */
  calm: boolean;
  /** Why nothing needs you, stated as fact rather than as apology. */
  calmDetail: string;
  /** No projects and no captures: the system has genuinely never been used. */
  nothingYet: boolean;
  counts: ProjectCounts & { unprocessed: number; captures: number };
}

export function deriveTodayState(input: TodayInput): TodayState {
  const now = input.now ?? new Date();
  const staleAfterDays = input.staleAfterDays ?? STALE_AFTER_DAYS;

  const projectCounts = countProjects(input.projects);
  const counts = {
    ...projectCounts,
    unprocessed: input.unprocessedTotal,
    captures: input.capturesTotal,
  };

  const attention = deriveAttention({
    projects: input.projects,
    unprocessed: input.unprocessed,
    unprocessedTotal: input.unprocessedTotal,
    now,
    staleAfterDays,
  });

  const nothingYet = counts.total === 0 && counts.captures === 0;
  const calm = !nothingYet && attention.length === 0;

  const raised = new Set(
    attention
      .filter((item) => item.evidence.type === "project")
      .map((item) => item.evidence.id),
  );

  return {
    headline: describeState(counts, nothingYet),
    attention,
    resume: pickResumable(input.projects, raised),
    calm,
    calmDetail: describeCalm(counts),
    nothingYet,
    counts,
  };
}

/**
 * The state of things in one sentence, assembled from counts alone. Every
 * clause corresponds to a number of real rows; a count of zero is omitted
 * rather than announced, because "0 blocked" is noise dressed as information.
 */
function describeState(
  counts: TodayState["counts"],
  nothingYet: boolean,
): string {
  if (nothingYet) return "Nothing has been captured yet.";

  const parts: string[] = [];
  if (counts.active > 0) {
    parts.push(`${counts.active} active ${plural(counts.active, "project")}`);
  }
  if (counts.blocked > 0) parts.push(`${counts.blocked} blocked`);
  if (counts.paused > 0) parts.push(`${counts.paused} paused`);
  if (counts.unprocessed > 0) {
    parts.push(
      `${counts.unprocessed} ${plural(counts.unprocessed, "capture")} waiting`,
    );
  }

  if (parts.length === 0) {
    return counts.closed > 0
      ? `Nothing open. ${counts.closed} ${plural(counts.closed, "project")} closed.`
      : "Nothing open.";
  }

  return `${parts.join(", ")}.`;
}

/**
 * Why nothing needs you.
 *
 * Only reached when the attention list is empty, which is what makes the claim
 * about next actions safe to state: if any active project lacked one, it would
 * be in that list instead.
 */
function describeCalm(counts: TodayState["counts"]): string {
  const parts: string[] = [];

  if (counts.active > 0) {
    parts.push(
      counts.active === 1
        ? "Your one active project knows its next action"
        : `All ${counts.active} active projects know their next action`,
    );
  }
  if (counts.paused > 0) {
    parts.push(`${counts.paused} ${plural(counts.paused, "project")} paused`);
  }
  if (counts.closed > 0) {
    parts.push(`${counts.closed} closed`);
  }
  if (counts.captures > 0) parts.push("your inbox is clear");

  if (parts.length === 0) return "There is nothing open and nothing waiting.";

  const sentence = parts.join(", ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
