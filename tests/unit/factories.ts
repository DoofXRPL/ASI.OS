import type { InboxItemRow, ProjectRow } from "@/lib/supabase/database.types";

/**
 * Row builders for the pure-derivation tests.
 *
 * These are shaped exactly like real rows, including the columns the code under
 * test never reads, so a test cannot accidentally pass because it was handed a
 * convenient object rather than a record.
 */

const USER = "00000000-0000-4000-8000-0000000000aa";

export function project(overrides: Partial<ProjectRow> = {}): ProjectRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    user_id: USER,
    name: "Loft conversion",
    outcome: null,
    status: "active",
    next_action: "Call the surveyor",
    blocked_reason: null,
    last_touched_at: "2026-07-25T09:00:00.000Z",
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-25T09:00:00.000Z",
    ...overrides,
  };
}

export function capture(overrides: Partial<InboxItemRow> = {}): InboxItemRow {
  return {
    id: "00000000-0000-4000-8000-0000000000f1",
    user_id: USER,
    content: "Ask the surveyor about the party wall",
    kind: null,
    status: "unprocessed",
    project_id: null,
    processed_into: null,
    processed_at: null,
    source: "manual",
    created_at: "2026-07-25T09:00:00.000Z",
    updated_at: "2026-07-25T09:00:00.000Z",
    ...overrides,
  };
}

/** A fixed "now", so nothing under test depends on when the suite runs. */
export const NOW = new Date("2026-07-25T12:00:00.000Z");

export function daysBefore(days: number, from: Date = NOW): string {
  return new Date(from.getTime() - days * 86_400_000).toISOString();
}
