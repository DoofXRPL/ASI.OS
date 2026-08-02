import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EarlyAccessOutcome } from "@/lib/db/early-access";

/**
 * What the visitor is told, for each thing the database can say.
 *
 * The action is the only place that turns an outcome into a sentence, and the
 * sentences matter: "we could not record this" and "you have sent too many"
 * describe different situations and imply different next steps, and getting them
 * the wrong way round tells someone their answers were refused when they were
 * only early.
 *
 * The database is mocked here because none of that is a database question. What
 * the database actually decides is tested against a real one in
 * tests/rls/intake-guard.test.ts.
 */

const recordEarlyAccessRequest = vi.fn();

vi.mock("@/lib/db/early-access", () => ({ recordEarlyAccessRequest }));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-forwarded-for": "203.0.113.7" })),
}));

const { requestEarlyAccessAction } = await import("@/lib/early-access/actions");
const { EMPTY_EARLY_ACCESS_STATE } = await import("@/lib/early-access/form-state");

function submission(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const fields = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    useCase: "research",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

function answers(outcome: EarlyAccessOutcome, code: string | null = null) {
  recordEarlyAccessRequest.mockResolvedValue({ outcome, code });
}

const submit = (formData: FormData) =>
  requestEarlyAccessAction(EMPTY_EARLY_ACCESS_STATE, formData);

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  answers("accepted");
});

afterEach(() => {
  vi.restoreAllMocks();
  recordEarlyAccessRequest.mockReset();
});

describe("a submission the database accepted", () => {
  it("is reported as recorded, and nothing else is claimed", async () => {
    const state = await submit(submission());

    expect(state).toEqual({ status: "recorded", error: null });
  });

  it("reaches the database with a caller the meter can count", async () => {
    await submit(submission());

    const [, client] = recordEarlyAccessRequest.mock.calls[0] ?? [];
    expect(client).toMatch(/^[0-9a-f]{32}$/);
    expect(client).not.toContain("203.0.113.7");
  });
});

describe("a submission that was rate limited", () => {
  it("says so as its own state, keeps the answers, and blames nobody", async () => {
    answers("throttled");
    const state = await submit(submission({ challenge: "Context is lost." }));

    expect(state.status).toBe("throttled");
    expect(state.error).toMatch(/too many requests/i);
    expect(state.error).toMatch(/nothing was saved/i);
    expect(state.values?.challenge).toBe("Context is lost.");
    expect(state.fieldErrors).toBeUndefined();
  });
});

describe("a submission nothing was configured to receive", () => {
  it("says the deployment is not set up, not that the request was wrong", async () => {
    answers("unconfigured");
    const state = await submit(submission());

    expect(state.status).toBe("unavailable");
    expect(state.error).toMatch(/not being recorded/i);
    expect(state.values?.email).toBe("ada@example.com");
  });
});

describe("a submission the database refused or could not complete", () => {
  /**
   * A refusal means the key was not recognised and a failure means something
   * broke. Both are the deployment's problem, and the visitor is told the same
   * thing because there is nothing they could do differently either way — and
   * because naming which of the two it was would describe the lock to whoever is
   * trying it.
   */
  for (const outcome of ["refused", "failed"] as const) {
    it(`explains nothing about how (${outcome})`, async () => {
      answers(outcome, "42501");
      const state = await submit(submission());

      expect(state.status).toBe("rejected");
      expect(state.error).toBe(
        "That request could not be recorded. Nothing was saved, so trying again is safe.",
      );
      expect(state.error).not.toMatch(/key|signature|rate|42501|postgres/i);
    });
  }

  it("keeps an unrecognised answer on the failing side", async () => {
    // A database that says something this code does not understand has not
    // recorded anything as far as this code can tell, and saying otherwise would
    // be the one dishonest option.
    answers("something-new" as EarlyAccessOutcome);
    const state = await submit(submission());

    expect(state.status).toBe("rejected");
  });
});

describe("a submission that failed validation", () => {
  it("never reaches the database", async () => {
    await submit(submission({ email: "not-an-address" }));

    expect(recordEarlyAccessRequest).not.toHaveBeenCalled();
  });

  it("marks the field and says nothing above the form", async () => {
    const state = await submit(submission({ email: "not-an-address" }));

    expect(state.status).toBe("rejected");
    expect(state.error).toBeNull();
    expect(state.fieldErrors?.email).toBe("That does not look like an email address.");
  });
});

describe("a submission that filled in the honeypot", () => {
  it("is answered exactly as a real one would be", async () => {
    const state = await submit(submission({ asi_hp: "http://spam.example" }));

    expect(state).toEqual({ status: "recorded", error: null });
  });

  it("is never sent to the database", async () => {
    await submit(submission({ asi_hp: "http://spam.example" }));

    expect(recordEarlyAccessRequest).not.toHaveBeenCalled();
  });
});

describe("the line each submission leaves behind", () => {
  const lines = (): Record<string, unknown>[] => {
    const spies = [vi.mocked(console.log), vi.mocked(console.warn)];
    return spies.flatMap((spy) =>
      spy.mock.calls.map((call) => JSON.parse(String(call[0])) as Record<string, unknown>),
    );
  };

  it("records the outcome and a correlation id, once per submission", async () => {
    await submit(submission());

    expect(lines()).toHaveLength(1);
    expect(lines()[0]).toMatchObject({ event: "early_access.intake", outcome: "accepted" });
    expect(String(lines()[0]?.correlationId)).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("holds nothing anybody typed, whatever they typed", async () => {
    await submit(
      submission({
        name: "Ada Lovelace",
        email: "ada@example.com",
        company: "Analytical Engines",
        challenge: "Context is lost between sessions.",
      }),
    );

    const line = JSON.stringify(lines());
    for (const secret of [
      "Ada Lovelace",
      "ada@example.com",
      "Analytical Engines",
      "Context is lost",
      "203.0.113.7",
    ]) {
      expect(line, `"${secret}" must not be logged`).not.toContain(secret);
    }
  });

  it("names the fields a rejection was about, and not what was in them", async () => {
    await submit(submission({ email: "definitely-not-an-address" }));

    expect(lines()[0]).toMatchObject({ outcome: "invalid", fields: ["email"] });
    expect(JSON.stringify(lines())).not.toContain("definitely-not-an-address");
  });

  it("says a honeypot was a honeypot, however the visitor was answered", async () => {
    await submit(submission({ asi_hp: "http://spam.example" }));

    expect(lines()[0]).toMatchObject({ outcome: "honeypot" });
    expect(JSON.stringify(lines())).not.toContain("spam.example");
  });

  it("records a failure's error code and never its message", async () => {
    answers("failed", "23514");
    await submit(submission());

    expect(lines()[0]).toMatchObject({ outcome: "failed", code: "23514" });
  });
});
