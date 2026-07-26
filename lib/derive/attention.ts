import type { InboxItemRow, ProjectRow } from "@/lib/supabase/database.types";
import { byLongestNeglected, daysSince, hasNextAction, isStale } from "./projects";

/**
 * What honestly needs a person, derived from rows they own.
 *
 * Four rules, in a fixed order, each traceable to a record. This is the
 * deterministic ancestor of the reasoning layer: an item may only exist because
 * a row exists, and `evidence` names that row. When a model eventually proposes
 * items here, it inherits the same obligation — nothing is shown that cannot be
 * traced to something real.
 *
 * What this file must never do: invent a deadline, score an importance, or
 * describe something as urgent, overdue or at risk. Elapsed time is a fact;
 * lateness is a judgement about a commitment nobody made.
 */

export const ATTENTION_REASONS = [
  "blocked",
  "no_next_action",
  "unprocessed_captures",
  "stale",
] as const;

export type AttentionReason = (typeof ATTENTION_REASONS)[number];

export interface AttentionEvidence {
  type: "project" | "inbox";
  id: string;
  /** How the record identifies itself, in its own words. */
  label: string;
}

export interface AttentionItem {
  /** Stable across identical inputs, so React keys and tests both behave. */
  id: string;
  reason: AttentionReason;
  headline: string;
  detail: string;
  suggestedAction: string;
  href: string;
  evidence: AttentionEvidence;
}

export interface AttentionInput {
  projects: ProjectRow[];
  /** Unprocessed captures the caller owns, any order. */
  unprocessed: InboxItemRow[];
  /** How many unprocessed captures exist, even if fewer were passed. */
  unprocessedTotal: number;
  now: Date;
  staleAfterDays: number;
}

/**
 * Explicit signals outrank inferred ones. A blocker you wrote down beats a
 * project missing a next action, which beats a queue you have not looked at,
 * which beats mere inactivity. Nothing is ranked by guessed importance.
 */
const REASON_ORDER: Record<AttentionReason, number> = {
  blocked: 0,
  no_next_action: 1,
  unprocessed_captures: 2,
  stale: 3,
};

export function deriveAttention(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const project of [...input.projects].sort(byLongestNeglected)) {
    if (project.status === "blocked") {
      items.push(blockedItem(project));
      continue;
    }

    if (project.status === "active" && !hasNextAction(project)) {
      items.push(noNextActionItem(project));
      continue;
    }

    if (isStale(project, input.now, input.staleAfterDays)) {
      items.push(staleItem(project, input.now));
    }
  }

  const captures = unprocessedItem(input);
  if (captures) items.push(captures);

  return items.sort(
    (a, b) => REASON_ORDER[a.reason] - REASON_ORDER[b.reason],
  );
}

function blockedItem(project: ProjectRow): AttentionItem {
  return {
    id: `blocked:${project.id}`,
    reason: "blocked",
    headline: `${project.name} is blocked.`,
    // The reason, exactly as it was written. Paraphrasing someone's own account
    // of what is in their way would be the system deciding it understood the
    // situation better than they did.
    detail: project.blocked_reason ?? "No reason was recorded.",
    suggestedAction: "Clear the blocker, or change the status if it has passed.",
    href: `/projects/${project.id}`,
    evidence: { type: "project", id: project.id, label: project.name },
  };
}

function noNextActionItem(project: ProjectRow): AttentionItem {
  return {
    id: `no_next_action:${project.id}`,
    reason: "no_next_action",
    headline: `${project.name} has no next action.`,
    detail:
      project.outcome !== null
        ? `Outcome: ${project.outcome}`
        : "This project does not say what it is for either.",
    suggestedAction: "Write the one thing that moves this forward.",
    href: `/projects/${project.id}`,
    evidence: { type: "project", id: project.id, label: project.name },
  };
}

function staleItem(project: ProjectRow, now: Date): AttentionItem {
  const days = daysSince(project.last_touched_at, now);
  return {
    id: `stale:${project.id}`,
    reason: "stale",
    headline: `${project.name} has not been touched in ${days} ${plural(days, "day")}.`,
    detail: `Next action: ${project.next_action}`,
    suggestedAction: "Pick it up, or pause it if you are not returning to it yet.",
    href: `/projects/${project.id}`,
    evidence: { type: "project", id: project.id, label: project.name },
  };
}

/**
 * One item for the whole queue rather than one per capture. A list of things
 * you have not read yet is one piece of information, not twenty.
 */
function unprocessedItem(input: AttentionInput): AttentionItem | null {
  if (input.unprocessedTotal < 1) return null;

  const oldest = [...input.unprocessed].sort((a, b) =>
    a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
  )[0];
  if (!oldest) return null;

  const days = daysSince(oldest.created_at, input.now);
  const total = input.unprocessedTotal;

  return {
    id: `unprocessed_captures:${oldest.id}`,
    reason: "unprocessed_captures",
    headline: `${total} ${plural(total, "capture")} waiting to be processed.`,
    detail:
      days === 0
        ? "The oldest arrived today."
        : `The oldest has been waiting ${days} ${plural(days, "day")}.`,
    suggestedAction: "Decide what each one is for, or archive it.",
    href: "/inbox",
    evidence: { type: "inbox", id: oldest.id, label: firstLine(oldest.content) },
  };
}

function firstLine(content: string): string {
  const line = content.trim().split("\n")[0]?.trim() ?? "";
  return line.length <= 80 ? line : `${line.slice(0, 79).trimEnd()}…`;
}

export function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`;
}
