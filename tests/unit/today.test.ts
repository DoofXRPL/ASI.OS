import { describe, expect, it } from "vitest";
import { deriveTodayState, tracksCommitments } from "@/lib/derive/today";
import type { ActivityEventRow } from "@/lib/supabase/database.types";

function event(overrides: Partial<ActivityEventRow> = {}): ActivityEventRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    user_id: "00000000-0000-4000-8000-0000000000aa",
    event_type: "auth.signed_in",
    actor: "user",
    summary: "Signed in",
    subject_type: null,
    subject_id: null,
    detail: {},
    occurred_at: "2026-07-25T09:00:00.000Z",
    created_at: "2026-07-25T09:00:00.000Z",
    ...overrides,
  };
}

/**
 * Today is the surface most tempted to overstate what the system knows. These
 * tests hold it to the rule that every sentence must be derivable from the rows
 * it was given.
 */
describe("deriveTodayState", () => {
  it("says plainly that nothing has happened when there is no history", () => {
    const state = deriveTodayState({ recentEvents: [], tracksCommitments: false });
    expect(state.headline).toBe("Nothing has happened in this system yet.");
    expect(state.lastEvent).toBeNull();
  });

  it("counts a single event in the singular", () => {
    const state = deriveTodayState({
      recentEvents: [event()],
      tracksCommitments: false,
    });
    expect(state.headline).toBe("1 event recorded so far.");
  });

  it("counts multiple events in the plural", () => {
    const state = deriveTodayState({
      recentEvents: [event(), event({ id: "b" }), event({ id: "c" })],
      tracksCommitments: false,
    });
    expect(state.headline).toBe("3 events recorded so far.");
  });

  it("reports the newest event as the last thing that happened", () => {
    const newest = event({ id: "newest", summary: "Identity updated" });
    const state = deriveTodayState({
      recentEvents: [newest, event({ id: "older" })],
      tracksCommitments: false,
    });
    expect(state.lastEvent).toBe(newest);
  });

  it("explains that nothing can need you while commitments are not tracked", () => {
    const state = deriveTodayState({ recentEvents: [], tracksCommitments: false });
    expect(state.detail).toContain("not holding commitments");
    // Must describe the present, never promise a future capability.
    expect(state.detail).not.toMatch(/soon|coming|will be able/i);
  });

  it("states that nothing needs you once commitments are tracked", () => {
    const state = deriveTodayState({ recentEvents: [], tracksCommitments: true });
    expect(state.detail).toBe("Nothing needs you.");
  });

  it("never invents a count", () => {
    const state = deriveTodayState({
      recentEvents: [event(), event({ id: "b" })],
      tracksCommitments: false,
    });
    expect(state.headline).toContain("2");
  });
});

describe("tracksCommitments", () => {
  it("is false while no records exist that could create a commitment", () => {
    // Flips to true in the phase that introduces projects and tasks. Today's
    // copy follows this flag rather than being edited by hand.
    expect(tracksCommitments()).toBe(false);
  });
});
