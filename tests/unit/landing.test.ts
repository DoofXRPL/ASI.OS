import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "@/components/os/nav";
import {
  ARCHITECTURE_LAYERS,
  landingLedger,
  PREVIEW,
  ROADMAP,
  STATUS_LABEL,
  STATUS_PANEL,
  TRUST_ENFORCED,
  type Status,
} from "@/lib/site/landing";
import * as earlyAccess from "@/lib/site/early-access";
import * as landing from "@/lib/site/landing";

/**
 * The front page is the only surface with no rows behind it, which makes it
 * the only surface where a false claim cannot be contradicted by the data.
 * These tests are that contradiction: they hold the page to the navigation,
 * to its own status vocabulary, and to the marketing language the product has
 * banned for itself.
 *
 * See docs/DECISIONS/0007-the-front-page-is-a-product-document.md.
 */

const STATUSES: Status[] = ["running", "in_development", "planned", "proposed"];

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
});

describe("the status vocabulary", () => {
  it("labels every status", () => {
    for (const status of STATUSES) {
      expect(STATUS_LABEL[status].trim().length).toBeGreaterThan(0);
    }
  });

  it("claims 'running' only where the repository can back it", () => {
    // The only running architecture layers are the ones that ship: surfaces
    // and the audit trail. Everything intelligent is not running, by design.
    const running = ARCHITECTURE_LAYERS.filter((layer) => layer.status === "running");
    expect(running.map((layer) => layer.name)).toEqual(["Audit"]);

    for (const layer of ARCHITECTURE_LAYERS) {
      expect(STATUSES).toContain(layer.status);
      expect(layer.note.trim().length).toBeGreaterThan(0);
    }
  });

  it("presents the Command Center preview as planned, never as a screenshot", () => {
    expect(PREVIEW.status).toBe("planned");
    expect(PREVIEW.caption.toLowerCase()).toContain("no live system");
  });

  it("keeps the hero status panel factual about what does not exist", () => {
    const values = STATUS_PANEL.map((row) => `${row.label} ${row.value}`).join(" ");
    expect(values).toContain("Not yet built");
    expect(values).toContain("None");

    // Nothing in the panel may claim a capability is running except the two
    // facts the repository enforces: the phase itself, and isolation.
    const running = STATUS_PANEL.filter((row) => row.status === "running");
    expect(running.map((row) => row.label)).toEqual(["System status", "Account isolation"]);
  });
});

describe("the roadmap", () => {
  it("has exactly one phase in progress and none complete", () => {
    const inProgress = ROADMAP.filter((phase) => phase.status === "in_progress");
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0]?.name).toBe("Foundation");

    for (const phase of ROADMAP) {
      expect(["in_progress", "planned"]).toContain(phase.status);
    }
  });

  it("numbers phases consecutively", () => {
    expect(ROADMAP.map((phase) => phase.index)).toEqual(
      ROADMAP.map((_, i) => String(i + 1).padStart(2, "0")),
    );
  });
});

describe("trust claims", () => {
  it("pairs every enforced claim with its mechanism", () => {
    expect(TRUST_ENFORCED.length).toBeGreaterThan(0);
    for (const item of TRUST_ENFORCED) {
      expect(item.mechanism.trim().length).toBeGreaterThan(10);
    }
  });
});

describe("the language the product banned for itself", () => {
  const banned = [
    "revolutionary",
    "game-changing",
    "game changing",
    "unlock",
    "supercharge",
    "world's most",
    "the future is here",
    "military",
    "enterprise-grade",
    "unbreakable",
    "total privacy",
    "cutting-edge",
    "urgent",
  ];

  // Every public module of copy, scanned as one. A new page is a new entry
  // here; a page that is not listed is a page the rule does not reach.
  const surfaces = {
    "the front page": landing,
    "the early-access page": earlyAccess,
  };

  for (const [name, module] of Object.entries(surfaces)) {
    it(`never appears anywhere in ${name}`, () => {
      const copy = JSON.stringify(module).toLowerCase();

      for (const phrase of banned) {
        expect(copy, `banned phrase "${phrase}" found in ${name}`).not.toContain(phrase);
      }
    });
  }
});

describe("the early-access page", () => {
  it("promises a review and never a date", () => {
    const copy = JSON.stringify(earlyAccess).toLowerCase();

    // Nothing may imply a queue that is moving, a place in it, or a deadline.
    for (const phrase of ["soon", "shortly", "within", "guarantee", "spots", "limited"]) {
      expect(copy, `"${phrase}" promises more than the page can keep`).not.toContain(phrase);
    }
  });

  it("says outright that there is no date to promise", () => {
    expect(earlyAccess.EARLY_ACCESS.note).toContain("no date to promise");
  });

  it("claims only what the database did", () => {
    // "Recorded" is what `public.request_early_access()` guarantees. Anything
    // stronger — reviewed, accepted, approved — would be the page describing a
    // human decision that has not been made.
    expect(earlyAccess.EARLY_ACCESS.success.receipt.toLowerCase()).toContain("recorded");
  });
});
