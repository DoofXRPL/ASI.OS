import { describe, expect, it } from "vitest";
import { deriveTodayState, STALE_AFTER_DAYS } from "@/lib/derive/today";
import { capture, daysBefore, NOW, project } from "./factories";

/**
 * Today is the surface most tempted to overstate what the system knows. These
 * tests hold it to the rule that every sentence must be derivable from the rows
 * it was given — no estimate, no rounding, no filling in.
 */

function today(input: {
  projects?: ReturnType<typeof project>[];
  unprocessed?: ReturnType<typeof capture>[];
  unprocessedTotal?: number;
  capturesTotal?: number;
}) {
  const unprocessed = input.unprocessed ?? [];
  const unprocessedTotal = input.unprocessedTotal ?? unprocessed.length;
  return deriveTodayState({
    projects: input.projects ?? [],
    unprocessed,
    unprocessedTotal,
    capturesTotal: input.capturesTotal ?? unprocessedTotal,
    now: NOW,
  });
}

describe("a system that has never been used", () => {
  it("says so plainly, and says it only when nothing at all exists", () => {
    const state = today({});
    expect(state.nothingYet).toBe(true);
    expect(state.headline).toBe("Nothing has been captured yet.");
    expect(state.calm).toBe(false);
  });

  it("is no longer 'nothing yet' once a capture has ever been made", () => {
    const state = today({ capturesTotal: 1, unprocessedTotal: 0 });
    expect(state.nothingYet).toBe(false);
  });

  it("never claims calm when there is nothing to be calm about", () => {
    // "Nothing needs you" over an empty database is technically true and
    // practically a lie: it implies the system looked at something.
    expect(today({}).calm).toBe(false);
  });
});

describe("the headline", () => {
  it("counts only what exists, and omits what does not", () => {
    const state = today({
      projects: [
        project({ id: "a" }),
        project({ id: "b" }),
        project({ id: "c", status: "blocked", blocked_reason: "Waiting on a quote" }),
      ],
      unprocessed: [capture({ id: "x" }), capture({ id: "y" })],
    });

    expect(state.headline).toBe("2 active projects, 1 blocked, 2 captures waiting.");
  });

  it("uses the singular for one of anything", () => {
    const state = today({
      projects: [project()],
      unprocessed: [capture()],
    });
    expect(state.headline).toBe("1 active project, 1 capture waiting.");
  });

  it("reports closed work rather than pretending there is none", () => {
    const state = today({
      projects: [project({ status: "done" }), project({ id: "b", status: "abandoned" })],
      capturesTotal: 0,
    });
    expect(state.headline).toBe("Nothing open. 2 projects closed.");
  });

  it("mentions paused projects, which are neither open work nor closed", () => {
    const state = today({ projects: [project({ status: "paused" })] });
    expect(state.headline).toBe("1 paused.");
  });
});

describe("calm", () => {
  it("is reached when records exist and nothing in them needs a person", () => {
    const state = today({
      projects: [project()],
      unprocessed: [],
      capturesTotal: 3,
    });

    expect(state.calm).toBe(true);
    expect(state.attention).toEqual([]);
    expect(state.calmDetail).toBe(
      "Your one active project knows its next action, your inbox is clear.",
    );
  });

  it("only claims every project knows its next action when that is checked", () => {
    const calm = today({
      projects: [project({ id: "a" }), project({ id: "b" })],
      capturesTotal: 0,
    });
    expect(calm.calmDetail).toContain("All 2 active projects know their next action");

    const notCalm = today({
      projects: [project({ id: "a" }), project({ id: "b", next_action: null })],
    });
    expect(notCalm.calm).toBe(false);
  });

  it("is not reached while anything is waiting", () => {
    const state = today({ projects: [project()], unprocessed: [capture()] });
    expect(state.calm).toBe(false);
    expect(state.attention).toHaveLength(1);
  });
});

describe("resuming work", () => {
  it("offers the active project touched most recently", () => {
    const state = today({
      projects: [
        project({ id: "older", last_touched_at: daysBefore(3) }),
        project({ id: "newest", last_touched_at: daysBefore(1) }),
      ],
      capturesTotal: 0,
    });

    expect(state.resume?.id).toBe("newest");
  });

  it("never offers a project that cannot be resumed", () => {
    const state = today({
      projects: [
        project({ id: "paused", status: "paused" }),
        project({ id: "no-action", next_action: null }),
      ],
    });

    expect(state.resume).toBeNull();
  });

  it("does not offer the same project it is already raising for attention", () => {
    // One project, blocked. Showing it as "easiest to resume" directly under an
    // item explaining that it is stuck would be the page contradicting itself.
    const state = today({
      projects: [
        project({ status: "blocked", blocked_reason: "Waiting on a quote" }),
      ],
    });

    expect(state.attention).toHaveLength(1);
    expect(state.resume).toBeNull();
  });

  it("still offers work to resume while other things need attention", () => {
    const state = today({
      projects: [
        project({ id: "ready", last_touched_at: daysBefore(1) }),
        project({ id: "stuck", next_action: null }),
      ],
    });

    expect(state.attention.map((item) => item.evidence.id)).toEqual(["stuck"]);
    expect(state.resume?.id).toBe("ready");
  });
});

describe("counts", () => {
  it("reports exactly what it was given", () => {
    const state = today({
      projects: [
        project({ id: "a" }),
        project({ id: "b", status: "blocked", blocked_reason: "Waiting" }),
        project({ id: "c", status: "paused" }),
        project({ id: "d", status: "done" }),
        project({ id: "e", status: "abandoned" }),
      ],
      unprocessedTotal: 4,
      capturesTotal: 11,
    });

    expect(state.counts).toEqual({
      total: 5,
      active: 1,
      blocked: 1,
      paused: 1,
      closed: 2,
      unprocessed: 4,
      captures: 11,
    });
  });
});

describe("the staleness threshold", () => {
  it("is a named constant, because it is a judgement rather than a measurement", () => {
    expect(STALE_AFTER_DAYS).toBe(14);
  });

  it("is applied by default", () => {
    const state = today({
      projects: [project({ last_touched_at: daysBefore(STALE_AFTER_DAYS) })],
    });
    expect(state.attention[0]?.reason).toBe("stale");
  });
});
