import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createBurstLimiter } from "@/lib/early-access/burst";
import {
  CLIENT_ID_LENGTH,
  clientIpFromHeaders,
  hashClientId,
  utcDayKey,
} from "@/lib/early-access/client-id";
import { getIntakeKey, INTAKE_KEY_MIN_LENGTH } from "@/lib/early-access/intake-key";
import {
  INTAKE_BODY_SIZE_LIMIT,
  INTAKE_BURST,
  INTAKE_MAX_BODY_BYTES,
} from "@/lib/early-access/limits";
import { intakeEvent, logIntake } from "@/lib/early-access/log";

/**
 * The front door has three layers, and these tests cover the two that are pure
 * arithmetic and text: the token bucket the proxy refuses a burst with, and the
 * digest that lets the database count a caller without being told who they are.
 *
 * The database's own layer is proven in tests/rls/intake-guard.test.ts against a
 * real PostgreSQL, because a limit enforced by a check no test has run is a
 * limit nobody has.
 */

describe("the body limit is one number, written twice", () => {
  it("says the same thing to Next.js and to the proxy", () => {
    const [, digits, unit] = /^(\d+)(b|kb|mb)$/.exec(INTAKE_BODY_SIZE_LIMIT) ?? [];
    expect(digits, "the limit must be a size Next.js understands").toBeDefined();

    const multiplier = { b: 1, kb: 1024, mb: 1024 * 1024 }[unit as "b" | "kb" | "mb"];
    expect(Number(digits) * multiplier).toBe(INTAKE_MAX_BODY_BYTES);
  });

  it("stays large enough for the longest submission the form can produce", () => {
    // Name, address, company and the two long answers, at the worst case of four
    // UTF-8 bytes per character, plus room for the encoding around them.
    const longestPossible = (120 + 254 + 120 + 2000 + 2000) * 4;
    expect(INTAKE_MAX_BODY_BYTES).toBeGreaterThan(longestPossible);
  });
});

describe("the burst limiter", () => {
  const policy = { capacity: 3, refillMs: 1_000, maxTracked: 10 };

  it("allows a burst up to the depth of the bucket and then stops", () => {
    const limiter = createBurstLimiter(policy);

    for (let attempt = 1; attempt <= policy.capacity; attempt += 1) {
      expect(limiter.take("a", 0).allowed, `attempt ${attempt}`).toBe(true);
    }

    expect(limiter.take("a", 0).allowed).toBe(false);
  });

  it("says how long to wait, and is right about it", () => {
    const limiter = createBurstLimiter(policy);
    for (let i = 0; i < policy.capacity; i += 1) limiter.take("a", 0);

    const refused = limiter.take("a", 0);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterMs).toBe(policy.refillMs);

    // Just short of the wait it advertised, and then exactly on it.
    expect(limiter.take("a", policy.refillMs - 1).allowed).toBe(false);
    expect(limiter.take("a", policy.refillMs).allowed).toBe(true);
  });

  it("refills to the brim and no further", () => {
    const limiter = createBurstLimiter(policy);
    for (let i = 0; i < policy.capacity; i += 1) limiter.take("a", 0);

    // An hour idle does not buy an hour's worth of tokens.
    const later = 3_600_000;
    for (let i = 0; i < policy.capacity; i += 1) {
      expect(limiter.take("a", later).allowed).toBe(true);
    }
    expect(limiter.take("a", later).allowed).toBe(false);
  });

  it("keeps one caller's burst away from another's", () => {
    const limiter = createBurstLimiter(policy);
    for (let i = 0; i < policy.capacity; i += 1) limiter.take("a", 0);

    expect(limiter.take("a", 0).allowed).toBe(false);
    expect(limiter.take("b", 0).allowed).toBe(true);
  });

  it("remembers no more callers than it said it would", () => {
    const limiter = createBurstLimiter(policy);

    // Every caller spends a token, so no bucket is full and none can be dropped
    // for being idle — the hard bound has to hold anyway.
    for (let i = 0; i < policy.maxTracked * 3; i += 1) {
      limiter.take(`caller-${i}`, i);
    }

    expect(limiter.tracked()).toBeLessThanOrEqual(policy.maxTracked);
  });

  it("is configured for a person rather than a script", () => {
    // A sustained rate a human cannot approach and a script needs, stated as a
    // test so tightening it is a decision rather than a typo.
    const perMinute = 60_000 / INTAKE_BURST.refillMs;
    expect(perMinute).toBeLessThanOrEqual(30);
    expect(INTAKE_BURST.capacity).toBeGreaterThanOrEqual(5);
  });
});

describe("the caller's digest", () => {
  const pepper = "a".repeat(64);
  const base = { ip: "203.0.113.7", dayKey: "2026-07-30", pepper };

  it("is the shape the database will accept and nothing else", () => {
    const digest = hashClientId(base);

    expect(digest).toMatch(/^[0-9a-f]{32}$/);
    expect(digest).toHaveLength(CLIENT_ID_LENGTH);
  });

  it("never contains the address it was made from", () => {
    expect(hashClientId(base)).not.toContain("203");
    expect(hashClientId(base)).not.toContain("113");
  });

  it("counts the same caller as the same caller", () => {
    expect(hashClientId(base)).toBe(hashClientId({ ...base }));
  });

  it("stops being the same caller tomorrow", () => {
    expect(hashClientId({ ...base, dayKey: "2026-07-31" })).not.toBe(hashClientId(base));
  });

  it("changes with the address and with the key", () => {
    expect(hashClientId({ ...base, ip: "203.0.113.8" })).not.toBe(hashClientId(base));
    expect(hashClientId({ ...base, pepper: "b".repeat(64) })).not.toBe(hashClientId(base));
  });

  it("gives an unattributed caller a real digest rather than an empty one", () => {
    const absent = hashClientId({ ...base, ip: null });

    expect(absent).toMatch(/^[0-9a-f]{32}$/);
    expect(absent).not.toBe(hashClientId(base));
  });

  it("keys the day by UTC, so a timezone cannot split one day into two", () => {
    expect(utcDayKey(new Date("2026-07-30T23:59:59.999Z"))).toBe("2026-07-30");
    expect(utcDayKey(new Date("2026-07-31T00:00:00.000Z"))).toBe("2026-07-31");
  });
});

describe("reading the caller's address off the request", () => {
  const from = (entries: Record<string, string>) => clientIpFromHeaders(new Headers(entries));

  it("prefers the headers that carry one address", () => {
    expect(
      from({
        "x-vercel-forwarded-for": "203.0.113.7",
        "x-real-ip": "198.51.100.1",
        "x-forwarded-for": "192.0.2.1",
      }),
    ).toBe("203.0.113.7");

    expect(from({ "x-real-ip": "198.51.100.1", "x-forwarded-for": "192.0.2.1" })).toBe(
      "198.51.100.1",
    );
  });

  it("takes the first entry of a forwarded chain, which is the client", () => {
    expect(from({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" })).toBe(
      "203.0.113.7",
    );
  });

  it("reports no address rather than an empty one", () => {
    expect(from({})).toBeNull();
    expect(from({ "x-forwarded-for": "" })).toBeNull();
    expect(from({ "x-forwarded-for": "  , 70.41.3.18" })).toBeNull();
  });
});

describe("the intake key", () => {
  const original = process.env.ASI_INTAKE_KEY;

  afterEach(() => {
    if (original === undefined) delete process.env.ASI_INTAKE_KEY;
    else process.env.ASI_INTAKE_KEY = original;
  });

  it("is absent until it is long enough to be real", () => {
    delete process.env.ASI_INTAKE_KEY;
    expect(getIntakeKey()).toBeNull();

    process.env.ASI_INTAKE_KEY = "   ";
    expect(getIntakeKey()).toBeNull();

    process.env.ASI_INTAKE_KEY = "x".repeat(INTAKE_KEY_MIN_LENGTH - 1);
    expect(getIntakeKey(), "a value too short to be generated is not a key").toBeNull();
  });

  it("is taken as given once it is", () => {
    process.env.ASI_INTAKE_KEY = `  ${"x".repeat(INTAKE_KEY_MIN_LENGTH)}  `;
    expect(getIntakeKey()).toBe("x".repeat(INTAKE_KEY_MIN_LENGTH));
  });
});

describe("what the front door writes down", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const correlationId = "b0a1f2c3-0000-4000-8000-000000000000";

  it("records the outcome, when, and which submission it was", () => {
    const event = intakeEvent({
      correlationId,
      outcome: "accepted",
      client: "0".repeat(32),
      durationMs: 12.6,
      now: new Date("2026-07-30T12:00:00.000Z"),
    });

    expect(event).toEqual({
      event: "early_access.intake",
      at: "2026-07-30T12:00:00.000Z",
      correlationId,
      outcome: "accepted",
      client: "0".repeat(32),
      durationMs: 13,
    });
  });

  it("leaves out what it was not given, rather than writing nulls", () => {
    const event = intakeEvent({ correlationId, outcome: "burst" });

    expect(Object.keys(event).sort()).toEqual(["at", "correlationId", "event", "outcome"]);
  });

  it("names the fields a submission failed on and never their values", () => {
    const event = intakeEvent({
      correlationId,
      outcome: "invalid",
      fields: ["email", "useCase"],
    });

    expect(event.fields).toEqual(["email", "useCase"]);
    expect(JSON.stringify(event)).not.toContain("@");
  });

  it("cannot be talked into carrying somebody's answers", () => {
    // The shape is closed on purpose: a caller who passes a name or an address
    // finds it dropped rather than logged. This is the guarantee that makes the
    // log safe to keep, so it is asserted rather than assumed.
    // Assigned to a variable first, so TypeScript's excess-property check does
    // not reject it: this is exactly the shape a call site would produce by
    // passing an object it built somewhere else.
    const smuggled = {
      correlationId,
      outcome: "accepted" as const,
      email: "ada@example.com",
      name: "Ada Lovelace",
      ip: "203.0.113.7",
    };

    const line = JSON.stringify(intakeEvent(smuggled));
    expect(line).not.toContain("ada@example.com");
    expect(line).not.toContain("Ada Lovelace");
    expect(line).not.toContain("203.0.113.7");
  });

  it("puts a refusal where a failure is looked for, and a success where it is not", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    logIntake(intakeEvent({ correlationId, outcome: "throttled" }));
    logIntake(intakeEvent({ correlationId, outcome: "accepted" }));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('"outcome":"throttled"');
  });

  it("writes one JSON object per line", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    logIntake(intakeEvent({ correlationId, outcome: "accepted" }));

    const line = String(log.mock.calls[0]?.[0]);
    expect(line).not.toContain("\n");
    expect(JSON.parse(line).event).toBe("early_access.intake");
  });
});

describe("the application and the migration agree about the door", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase", "migrations", "0004_intake_guard.sql"),
    "utf8",
  );

  it("requires a key and a caller, with no default to fall back to", () => {
    // Defaults here would be the bypass: PostgREST resolves a function by the
    // arguments it is given, so an argument with a default is an argument a
    // caller may leave out.
    expect(migration).toMatch(/p_key\s+text,/);
    expect(migration).toMatch(/p_client\s+text,/);
    expect(migration).not.toMatch(/p_key\s+text\s+default/);
    expect(migration).not.toMatch(/p_client\s+text\s+default/);
  });

  it("drops the unguarded signature instead of leaving it alongside", () => {
    expect(migration).toContain(
      "drop function if exists public.request_early_access(text, text, text, text, text, text, text);",
    );
  });

  it("constrains the counter to the digest this code produces", () => {
    expect(migration).toContain("check (client_hash ~ '^[0-9a-f]{32}$')");
    expect(hashClientId({ ip: "203.0.113.7", dayKey: "2026-07-30", pepper: "p" })).toMatch(
      /^[0-9a-f]{32}$/,
    );
  });

  it("keeps the counters and the key digests out of reach of the API roles", () => {
    for (const table of ["intake_keys", "intake_limits", "intake_attempts"]) {
      expect(migration).toContain(
        `revoke all on access.${table} from public, anon, authenticated;`,
      );
      expect(migration).toContain(`alter table access.${table} enable row level security;`);
    }
  });
});
