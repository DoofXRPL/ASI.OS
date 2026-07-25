import { describe, expect, it } from "vitest";
import { deriveAttention } from "@/lib/derive/attention";
import { capture, daysBefore, NOW, project } from "./factories";

/**
 * The attention list is where this product is most tempted to overstate what it
 * knows. These tests hold it to two rules: every item must be traceable to a
 * row that was passed in, and nothing may be invented — no deadline, no
 * priority, no urgency that the reader did not put there themselves.
 */

function derive(input: {
  projects?: ReturnType<typeof project>[];
  unprocessed?: ReturnType<typeof capture>[];
  unprocessedTotal?: number;
  staleAfterDays?: number;
}) {
  return deriveAttention({
    projects: input.projects ?? [],
    unprocessed: input.unprocessed ?? [],
    unprocessedTotal: input.unprocessedTotal ?? (input.unprocessed?.length ?? 0),
    now: NOW,
    staleAfterDays: input.staleAfterDays ?? 14,
  });
}

describe("what raises attention", () => {
  it("raises nothing when there is nothing to raise", () => {
    expect(derive({})).toEqual([]);
  });

  it("raises a blocked project and quotes the reason exactly as written", () => {
    const reason = "Waiting on the neighbour's surveyor to reply — chased twice";
    const items = derive({
      projects: [project({ status: "blocked", blocked_reason: reason })],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.reason).toBe("blocked");
    expect(items[0]?.detail).toBe(reason);
  });

  it("raises an active project that has no next action", () => {
    const items = derive({ projects: [project({ next_action: null })] });

    expect(items[0]?.reason).toBe("no_next_action");
    expect(items[0]?.headline).toBe("Loft conversion has no next action.");
  });

  it("treats a whitespace-only next action as no next action", () => {
    const items = derive({ projects: [project({ next_action: "   " })] });
    expect(items[0]?.reason).toBe("no_next_action");
  });

  it("names the outcome when one exists, and says so when one does not", () => {
    const withOutcome = derive({
      projects: [project({ next_action: null, outcome: "A habitable loft" })],
    });
    expect(withOutcome[0]?.detail).toBe("Outcome: A habitable loft");

    const without = derive({ projects: [project({ next_action: null })] });
    expect(without[0]?.detail).toContain("does not say what it is for");
  });

  it("raises one item for the whole capture queue, not one per capture", () => {
    const items = derive({
      unprocessed: [
        capture({ id: "a", created_at: daysBefore(3) }),
        capture({ id: "b", created_at: daysBefore(1) }),
        capture({ id: "c", created_at: daysBefore(0.2) }),
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.headline).toBe("3 captures waiting to be processed.");
  });

  it("measures the queue from its oldest capture", () => {
    const items = derive({
      unprocessed: [
        capture({ id: "new", created_at: daysBefore(1) }),
        capture({ id: "old", created_at: daysBefore(9) }),
      ],
    });

    expect(items[0]?.detail).toBe("The oldest has been waiting 9 days.");
    expect(items[0]?.evidence.id).toBe("old");
  });

  it("says a same-day capture arrived today rather than claiming zero days", () => {
    const items = derive({ unprocessed: [capture({ created_at: daysBefore(0.1) })] });
    expect(items[0]?.detail).toBe("The oldest arrived today.");
  });

  it("counts the queue from the database total, not from the rows it was shown", () => {
    const items = derive({
      unprocessed: [capture({ id: "only-one-loaded" })],
      unprocessedTotal: 212,
    });
    expect(items[0]?.headline).toBe("212 captures waiting to be processed.");
  });

  it("raises an untouched project once it passes the threshold", () => {
    const items = derive({
      projects: [project({ last_touched_at: daysBefore(14) })],
      staleAfterDays: 14,
    });

    expect(items[0]?.reason).toBe("stale");
    expect(items[0]?.headline).toBe(
      "Loft conversion has not been touched in 14 days.",
    );
  });

  it("says nothing about a project one day short of the threshold", () => {
    const items = derive({
      projects: [project({ last_touched_at: daysBefore(13) })],
      staleAfterDays: 14,
    });
    expect(items).toEqual([]);
  });
});

describe("what stays quiet", () => {
  it("leaves paused, done and abandoned projects alone", () => {
    for (const status of ["paused", "done", "abandoned"]) {
      const items = derive({
        projects: [
          project({ status, next_action: null, last_touched_at: daysBefore(90) }),
        ],
      });
      expect(items, `${status} must not raise attention`).toEqual([]);
    }
  });

  it("does not raise a project twice for the same neglect", () => {
    // Blocked and untouched for months: one item, the one the reader wrote.
    const items = derive({
      projects: [
        project({
          status: "blocked",
          blocked_reason: "Permit not granted",
          last_touched_at: daysBefore(120),
        }),
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.reason).toBe("blocked");
  });

  it("never invents urgency, a deadline, or a score", () => {
    const items = derive({
      projects: [
        project({ id: "p1", status: "blocked", blocked_reason: "Waiting on a quote" }),
        project({ id: "p2", next_action: null }),
        project({ id: "p3", last_touched_at: daysBefore(40) }),
      ],
      unprocessed: [capture({ created_at: daysBefore(6) })],
    });

    const text = items
      .flatMap((item) => [item.headline, item.detail, item.suggestedAction])
      .join(" ");

    expect(text).not.toMatch(
      /urgent|overdue|late|deadline|priority|high|critical|at risk|important/i,
    );
  });
});

describe("ordering and evidence", () => {
  it("puts what you said before what was inferred", () => {
    const items = derive({
      projects: [
        project({ id: "p3", last_touched_at: daysBefore(40) }),
        project({ id: "p2", next_action: null }),
        project({
          id: "p1",
          status: "blocked",
          blocked_reason: "Waiting on a quote",
        }),
      ],
      unprocessed: [capture()],
    });

    expect(items.map((item) => item.reason)).toEqual([
      "blocked",
      "no_next_action",
      "unprocessed_captures",
      "stale",
    ]);
  });

  it("raises the longest neglected first within one reason", () => {
    const items = derive({
      projects: [
        project({ id: "recent", next_action: null, last_touched_at: daysBefore(1) }),
        project({ id: "oldest", next_action: null, last_touched_at: daysBefore(30) }),
        project({ id: "middle", next_action: null, last_touched_at: daysBefore(10) }),
      ],
    });

    expect(items.map((item) => item.evidence.id)).toEqual([
      "oldest",
      "middle",
      "recent",
    ]);
  });

  it("orders identically for identical input, so the page never reshuffles", () => {
    const rows = [
      project({ id: "bbb", next_action: null, last_touched_at: daysBefore(5) }),
      project({ id: "aaa", next_action: null, last_touched_at: daysBefore(5) }),
    ];

    const first = derive({ projects: rows }).map((item) => item.id);
    const second = derive({ projects: [...rows].reverse() }).map((item) => item.id);

    expect(first).toEqual(second);
  });

  it("gives every item evidence that resolves to a row it was given", () => {
    const projects = [
      project({ id: "p1", status: "blocked", blocked_reason: "Waiting on a quote" }),
      project({ id: "p2", next_action: null }),
      project({ id: "p3", last_touched_at: daysBefore(40) }),
    ];
    const unprocessed = [capture({ id: "c1" })];

    const items = derive({ projects, unprocessed });
    const known = new Set([
      ...projects.map((p) => p.id),
      ...unprocessed.map((c) => c.id),
    ]);

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(known.has(item.evidence.id), `${item.id} cites an unknown row`).toBe(
        true,
      );
      expect(item.href).toContain(
        item.evidence.type === "project" ? item.evidence.id : "/inbox",
      );
    }
  });

  it("produces nothing at all from an empty record set", () => {
    // The strongest form of "never fabricate": with no rows, there is nothing
    // to derive, and no wording that could imply otherwise.
    expect(derive({ unprocessedTotal: 0 })).toEqual([]);
  });
});
