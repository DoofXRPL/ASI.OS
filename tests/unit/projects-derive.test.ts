import { describe, expect, it } from "vitest";
import {
  byLongestNeglected,
  countProjects,
  daysSince,
  hasNextAction,
  isStale,
  pickResumable,
  sortProjectsForList,
} from "@/lib/derive/projects";
import { daysBefore, NOW, project } from "./factories";

describe("elapsed time", () => {
  it("counts whole days only, so a partial day is never rounded up", () => {
    expect(daysSince(daysBefore(0.9), NOW)).toBe(0);
    expect(daysSince(daysBefore(1.9), NOW)).toBe(1);
    expect(daysSince(daysBefore(30), NOW)).toBe(30);
  });

  it("treats a future timestamp as no time elapsed rather than negative time", () => {
    const tomorrow = new Date(NOW.getTime() + 86_400_000).toISOString();
    expect(daysSince(tomorrow, NOW)).toBe(0);
  });

  it("survives an unparseable timestamp instead of producing NaN", () => {
    expect(daysSince("not a date", NOW)).toBe(0);
  });
});

describe("having a next action", () => {
  it("requires more than whitespace", () => {
    expect(hasNextAction(project({ next_action: "Call the surveyor" }))).toBe(true);
    expect(hasNextAction(project({ next_action: null }))).toBe(false);
    expect(hasNextAction(project({ next_action: "  " }))).toBe(false);
  });
});

describe("staleness", () => {
  it("applies only to active work that already knows its next step", () => {
    const untouched = { last_touched_at: daysBefore(60) };

    expect(isStale(project(untouched), NOW, 14)).toBe(true);
    expect(isStale(project({ ...untouched, status: "paused" }), NOW, 14)).toBe(false);
    expect(isStale(project({ ...untouched, next_action: null }), NOW, 14)).toBe(false);
  });

  it("includes the threshold day itself", () => {
    expect(isStale(project({ last_touched_at: daysBefore(14) }), NOW, 14)).toBe(true);
    expect(isStale(project({ last_touched_at: daysBefore(13.5) }), NOW, 14)).toBe(false);
  });
});

describe("counting", () => {
  it("groups done and abandoned together as decided", () => {
    const counts = countProjects([
      project({ id: "a" }),
      project({ id: "b", status: "blocked", blocked_reason: "Waiting" }),
      project({ id: "c", status: "paused" }),
      project({ id: "d", status: "done" }),
      project({ id: "e", status: "abandoned" }),
    ]);

    expect(counts).toEqual({ total: 5, active: 1, blocked: 1, paused: 1, closed: 2 });
  });

  it("counts nothing as nothing", () => {
    expect(countProjects([])).toEqual({
      total: 0,
      active: 0,
      blocked: 0,
      paused: 0,
      closed: 0,
    });
  });
});

describe("ordering", () => {
  it("puts the longest neglected first and breaks ties on identity", () => {
    const rows = [
      project({ id: "bbb", last_touched_at: daysBefore(1) }),
      project({ id: "aaa", last_touched_at: daysBefore(1) }),
      project({ id: "ccc", last_touched_at: daysBefore(9) }),
    ];

    expect([...rows].sort(byLongestNeglected).map((p) => p.id)).toEqual([
      "ccc",
      "aaa",
      "bbb",
    ]);
  });

  it("lists open work above decided work, recency inside each group", () => {
    const rows = [
      project({ id: "done-recent", status: "done", last_touched_at: daysBefore(0) }),
      project({ id: "open-old", last_touched_at: daysBefore(20) }),
      project({ id: "open-new", last_touched_at: daysBefore(2) }),
    ];

    expect(sortProjectsForList(rows).map((p) => p.id)).toEqual([
      "open-new",
      "open-old",
      "done-recent",
    ]);
  });

  it("does not mutate the array it was given", () => {
    const rows = [
      project({ id: "b", last_touched_at: daysBefore(1) }),
      project({ id: "a", last_touched_at: daysBefore(9) }),
    ];
    sortProjectsForList(rows);
    expect(rows.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("picking work to resume", () => {
  it("chooses the most recently touched active project that can move", () => {
    const chosen = pickResumable([
      project({ id: "stale", last_touched_at: daysBefore(30) }),
      project({ id: "fresh", last_touched_at: daysBefore(1) }),
      project({ id: "no-action", next_action: null, last_touched_at: daysBefore(0) }),
    ]);

    expect(chosen?.id).toBe("fresh");
  });

  it("skips anything already being raised elsewhere", () => {
    const chosen = pickResumable(
      [
        project({ id: "raised", last_touched_at: daysBefore(1) }),
        project({ id: "quiet", last_touched_at: daysBefore(5) }),
      ],
      new Set(["raised"]),
    );

    expect(chosen?.id).toBe("quiet");
  });

  it("returns nothing rather than something unsuitable", () => {
    expect(pickResumable([])).toBeNull();
    expect(pickResumable([project({ status: "done" })])).toBeNull();
  });
});
