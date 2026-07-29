import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/os/nav";
import { ATTENTION_REASONS } from "@/lib/derive/attention";
import {
  ATTENTION_RULES,
  landingLedger,
  LOOP_COPY,
  loopStatusSentence,
  PRINCIPLE_COPY,
  STACK,
} from "@/lib/site/landing";

/**
 * The front page is the only surface with no rows behind it, which makes it the
 * only surface where a false claim cannot be contradicted by the data. These
 * tests are that contradiction: they hold the page to the navigation, to the
 * derivation, and to the loop it says it serves.
 *
 * See docs/DECISIONS/0005-the-front-page-states-the-build.md.
 */

describe("the ledger of what works", () => {
  it("names exactly the surfaces the navigation serves", () => {
    const ledger = landingLedger(NAV_ITEMS);

    expect(ledger.working.map((surface) => surface.href)).toEqual(
      NAV_ITEMS.map((item) => item.href),
    );
    expect(ledger.working.map((surface) => surface.label)).toEqual(
      NAV_ITEMS.map((item) => item.label),
    );
  });

  it("quotes each surface's own statement of purpose rather than a new one", () => {
    const ledger = landingLedger(NAV_ITEMS);

    for (const surface of ledger.working) {
      const item = NAV_ITEMS.find((candidate) => candidate.href === surface.href);
      expect(surface.purpose).toBe(item?.purpose);
    }
  });

  it("never lists a surface as both working and absent", () => {
    const ledger = landingLedger(NAV_ITEMS);
    const working = new Set(
      ledger.working.map((surface) => surface.label.toLowerCase()),
    );

    for (const absent of ledger.absent) {
      expect(working.has(absent.label.toLowerCase())).toBe(false);
    }
  });

  it("drops an absent surface the moment it enters the navigation", () => {
    const before = landingLedger(NAV_ITEMS);
    expect(before.absent.map((item) => item.label)).toContain("Memory");

    const after = landingLedger([
      ...NAV_ITEMS,
      { href: "/memory", label: "Memory", purpose: "Confirmed facts, with sources." },
    ]);

    expect(after.absent.map((item) => item.label)).not.toContain("Memory");
    expect(after.working.map((item) => item.label)).toContain("Memory");
  });

  it("says where an absent surface sits in the plan, so it is not a vague promise", () => {
    for (const absent of landingLedger(NAV_ITEMS).absent) {
      expect(absent.phase).toMatch(/^Phase \d$/);
      expect(absent.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("the attention rules the page prints", () => {
  it("describes every rule the derivation can emit, and no others", () => {
    expect(ATTENTION_RULES.map((rule) => rule.reason)).toEqual([
      ...ATTENTION_REASONS,
    ]);
  });

  it("gives each rule a description", () => {
    for (const rule of ATTENTION_RULES) {
      expect(rule.detail.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("the loop, as the page states it", () => {
  it("covers the six stages in order", () => {
    expect(LOOP_COPY.map((stage) => stage.stage)).toEqual([
      "Observe",
      "Understand",
      "Recommend",
      "Approve",
      "Act",
      "Remember",
    ]);
  });

  it("marks each stage as running or as designed but not built", () => {
    for (const stage of LOOP_COPY) {
      expect(["running", "designed"]).toContain(stage.status);
    }

    expect(LOOP_COPY.some((stage) => stage.status === "designed")).toBe(true);
  });

  it("counts the stages for the hero rather than letting it claim a number", () => {
    expect(loopStatusSentence()).toBe(
      "Four of those six stages run today, on deterministic code and no model. The other two are designed and not built, and this page says which.",
    );
  });

  it("recounts when a stage starts running, so the hero cannot go stale", () => {
    const oneLeft = loopStatusSentence(
      LOOP_COPY.map((stage) =>
        stage.stage === "Act" ? stage : { ...stage, status: "running" as const },
      ),
    );
    expect(oneLeft).toContain("Five of those six stages run today");
    expect(oneLeft).toContain("The remaining one is designed and not built");

    const allRunning = loopStatusSentence(
      LOOP_COPY.map((stage) => ({ ...stage, status: "running" as const })),
    );
    expect(allRunning).toBe(
      "Six of those six stages run today, on deterministic code and no model. The loop is closed.",
    );
  });

  it("mentions a model in a running stage only to deny that one is involved", () => {
    for (const stage of LOOP_COPY.filter((item) => item.status === "running")) {
      const text = `${stage.claim} ${stage.detail}`.toLowerCase();
      if (text.includes("model")) expect(text).toMatch(/no model/);
    }
  });
});

describe("the supporting copy", () => {
  it("gives every principle a place it is enforced", () => {
    for (const principle of PRINCIPLE_COPY) {
      expect(principle.enforcedBy.trim().length).toBeGreaterThan(0);
    }
  });

  it("names no version numbers in the stack, which would go stale unnoticed", () => {
    for (const entry of STACK) {
      expect(`${entry.name} ${entry.role}`).not.toMatch(/\d+\.\d+/);
    }
  });
});
