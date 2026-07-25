import type { ActivityEventRow } from "@/lib/supabase/database.types";

/**
 * What Today can honestly say about the system right now.
 *
 * This is a pure function over real rows so it can be tested exhaustively
 * without a database, and so the wording can never drift away from the data it
 * describes.
 *
 * The hard rule it exists to enforce: every sentence returned here must be
 * derivable from `input`. Nothing is estimated, rounded up, or filled in.
 */
export interface TodayInput {
  /** Events the caller actually owns, newest first. */
  recentEvents: ActivityEventRow[];
  /** True once ASI can hold commitments, projects and tasks. */
  tracksCommitments: boolean;
}

export interface TodayState {
  /** One sentence describing the state of things. */
  headline: string;
  /** Why nothing needs the reader, stated as fact rather than apology. */
  detail: string;
  /** The most recent thing that happened, if anything has. */
  lastEvent: ActivityEventRow | null;
}

export function deriveTodayState(input: TodayInput): TodayState {
  const lastEvent = input.recentEvents[0] ?? null;
  const count = input.recentEvents.length;

  if (!input.tracksCommitments) {
    return {
      headline:
        count === 0
          ? "Nothing has happened in this system yet."
          : `${count} ${count === 1 ? "event" : "events"} recorded so far.`,
      // Stated in the present tense about what is true, not as a promise.
      detail:
        "ASI is not holding commitments, projects or tasks, so nothing can need your attention. What it does hold is your identity and a complete record of everything done here.",
      lastEvent,
    };
  }

  return {
    headline:
      count === 0
        ? "Nothing has happened in this system yet."
        : `${count} ${count === 1 ? "event" : "events"} recorded so far.`,
    detail: "Nothing needs you.",
    lastEvent,
  };
}

/**
 * Whether ASI can hold commitments yet.
 *
 * Phase 0 provisions identity and the audit trail only. This returns false until
 * the records that make a daily plan possible actually exist, so Today describes
 * the system as it is rather than as it is intended to become.
 */
export function tracksCommitments(): boolean {
  return false;
}
