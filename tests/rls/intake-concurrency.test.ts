import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  connect,
  inParallel,
  registerIntakeKey,
  testClientHash,
  withParallelAnon,
} from "./harness";

/**
 * The tests that were missing, and whose absence is the reason 125 passing ones
 * said nothing about whether the front door has a limit.
 *
 * Every other suite here submits on one connection inside a transaction that is
 * rolled back. That is the right shape for asking what a role may touch, and it
 * cannot see a limit that is read and then acted on: one connection always
 * observes its own uncommitted rows, so a check-then-act meter looks perfect.
 * These tests use real backends committing for real, which is what PostgREST
 * does, and they fail against the meter in 0004 by a wide margin.
 *
 * Everything here commits, so each test cleans up after itself rather than
 * relying on a rollback.
 *
 * See supabase/migrations/0005_intake_meter_is_atomic.sql.
 */

const KEY = "intake-concurrency-suite-key-0123456789";
const COUNTERS = "access.intake_counters";
const QUEUE = "access.early_access_requests";

const CALL = `select public.request_early_access(
  p_key => $1, p_client => $2,
  p_name => 'Ada Lovelace', p_email => $3, p_use_case => 'research'
) as result`;

let admin: Client;

beforeAll(async () => {
  admin = await connect();
  await registerIntakeKey(admin, KEY, "intake-concurrency-suite");
});

afterEach(async () => {
  await admin.query(`delete from ${QUEUE} where email like 'concurrent-%'`);
  await admin.query(`delete from ${COUNTERS}`);
});

afterAll(async () => {
  await admin?.end();
});

/** The thresholds, set for real: these tests are not inside a transaction. */
async function setLimits(columns: Record<string, string>): Promise<void> {
  const assignments = Object.entries(columns)
    .map(([column, value]) => `${column} = ${value}`)
    .join(", ");
  await admin.query(`update access.intake_limits set ${assignments}`);
}

async function queued(): Promise<number> {
  const { rows } = await admin.query<{ total: number }>(
    `select count(*)::int as total from ${QUEUE} where email like 'concurrent-%'`,
  );
  return rows[0]?.total ?? 0;
}

const tally = (outcomes: string[]): Record<string, number> =>
  outcomes.reduce<Record<string, number>>(
    (totals, outcome) => ({ ...totals, [outcome]: (totals[outcome] ?? 0) + 1 }),
    {},
  );

const email = (index: number): string =>
  `concurrent-${index}-${Math.random().toString(36).slice(2, 10)}@example.com`;

describe("the per-caller limit holds against callers arriving at once", () => {
  it("admits exactly the limit out of forty simultaneous calls", async () => {
    await setLimits({ per_client_max: "5", global_max: "1000" });
    const client = testClientHash();

    const outcomes = await withParallelAnon(40, (clients) =>
      inParallel(clients, CALL, (index) => [KEY, client, email(index)]),
    );

    // The number that matters is the rows, not the answers: a meter that admits
    // more than it says is one that let rows through.
    expect(await queued()).toBe(5);
    expect(tally(outcomes)).toEqual({ accepted: 5, throttled: 35 });
  });

  it("admits exactly the limit out of a hundred simultaneous calls", async () => {
    // The failure this replaces got worse with concurrency rather than better,
    // so the higher number is the load-bearing one.
    await setLimits({ per_client_max: "3", global_max: "1000" });
    const client = testClientHash();

    await withParallelAnon(100, (clients) =>
      inParallel(clients, CALL, (index) => [KEY, client, email(index)]),
    );

    expect(await queued()).toBe(3);
  });

  it("never records more admissions than the threshold in force", async () => {
    await setLimits({ per_client_max: "4", global_max: "1000" });
    const client = testClientHash();

    await withParallelAnon(30, (clients) =>
      inParallel(clients, CALL, (index) => [KEY, client, email(index)]),
    );

    const { rows } = await admin.query<{ admitted: number; refused: number }>(
      `select admitted, refused from ${COUNTERS} where bucket = $1`,
      [client],
    );
    expect(rows[0]?.admitted, "the count cannot exceed the limit that gates it").toBe(4);
    expect(rows[0]?.refused).toBe(26);
  });

  it("counts one caller separately from another under the same load", async () => {
    await setLimits({ per_client_max: "2", global_max: "1000" });
    const first = testClientHash();
    const second = testClientHash();

    await withParallelAnon(40, (clients) =>
      inParallel(clients, CALL, (index) => [
        KEY,
        index % 2 === 0 ? first : second,
        email(index),
      ]),
    );

    expect(await queued()).toBe(4);
  });
});

describe("the deployment-wide ceiling holds against callers arriving at once", () => {
  it("admits exactly the ceiling out of sixty simultaneous distinct callers", async () => {
    await setLimits({ per_client_max: "1000", global_max: "10" });

    await withParallelAnon(60, (clients) =>
      inParallel(clients, CALL, (index) => [KEY, testClientHash(), email(index)]),
    );

    expect(await queued()).toBe(10);
  });

  it("charges the ceiling nothing for a caller already over their own limit", async () => {
    // The order of the two checks is what makes this true, and it is what stops
    // one caller from spending everybody else's budget.
    await setLimits({ per_client_max: "2", global_max: "50" });
    const client = testClientHash();

    await withParallelAnon(30, (clients) =>
      inParallel(clients, CALL, (index) => [KEY, client, email(index)]),
    );

    const { rows } = await admin.query<{ admitted: number }>(
      `select admitted from ${COUNTERS} where bucket = 'deployment'`,
    );
    expect(rows[0]?.admitted).toBe(2);
  });
});

describe("a refusal is not the reason for the next refusal", () => {
  it("does not let a refused call raise the number that refused it", async () => {
    // The denial of service this replaces: refusals counted towards the window
    // they were refused by, so knocking faster than the ceiling drained held the
    // form shut for everybody, indefinitely, for about four requests a minute.
    await setLimits({ per_client_max: "1000", global_max: "3" });

    await withParallelAnon(3, (clients) =>
      inParallel(clients, CALL, (index) => [KEY, testClientHash(), email(index)]),
    );

    const before = await admin.query<{ admitted: number }>(
      `select admitted from ${COUNTERS} where bucket = 'deployment'`,
    );
    expect(before.rows[0]?.admitted).toBe(3);

    // Forty more refused knocks, which under the old meter would have taken the
    // window to forty-three and kept it there.
    const outcomes = await withParallelAnon(40, (clients) =>
      inParallel(clients, CALL, (index) => [KEY, testClientHash(), email(100 + index)]),
    );
    expect(new Set(outcomes)).toEqual(new Set(["throttled"]));

    const after = await admin.query<{ admitted: number; refused: number }>(
      `select admitted, refused from ${COUNTERS} where bucket = 'deployment'`,
    );
    expect(after.rows[0]?.admitted, "knocking cannot raise the ceiling's own count").toBe(3);
    expect(after.rows[0]?.refused, "the refusals are recorded, and decide nothing").toBe(40);
  });

  it("lets the next window in, however hard the last one was knocked on", async () => {
    await setLimits({
      per_client_max: "1000",
      global_max: "2",
      global_window: "interval '1 minute'",
    });

    await withParallelAnon(20, (clients) =>
      inParallel(clients, CALL, (index) => [KEY, testClientHash(), email(index)]),
    );
    expect(await queued()).toBe(2);

    // A window is a row, so the next one starts at nothing rather than draining
    // whatever the last one accumulated. Moving this row back is the same thing
    // as a minute passing.
    await admin.query(
      `update ${COUNTERS} set window_start = window_start - interval '2 minutes'
        where bucket = 'deployment'`,
    );

    const outcomes = await withParallelAnon(3, (clients) =>
      inParallel(clients, CALL, (index) => [KEY, testClientHash(), email(200 + index)]),
    );
    expect(tally(outcomes)).toEqual({ accepted: 2, throttled: 1 });
  });
});

describe("counting costs the same however much has been counted", () => {
  it("reads a bucket by primary key rather than scanning a window", async () => {
    // The other half of the old meter's problem: `count(*)` over the window grew
    // with the flood, so an attacker bought latency on every later call. This is
    // the property that makes that impossible, asserted against the planner
    // rather than a stopwatch.
    await setLimits({ per_client_max: "5", global_max: "1000" });

    await admin.query(
      `insert into ${COUNTERS} (bucket, window_start, admitted, refused)
       select md5(g::text), access.intake_window(now(), interval '15 minutes'), 1, 0
         from generate_series(1, 20000) g
       on conflict do nothing`,
    );
    await admin.query(`analyze ${COUNTERS}`);

    const { rows } = await admin.query<{ "QUERY PLAN": string }>(
      `explain (costs off)
         insert into ${COUNTERS} as c (bucket, window_start, admitted)
         values ($1, access.intake_window(now(), interval '15 minutes'), 1)
         on conflict (bucket, window_start) do update set admitted = c.admitted + 1
           where c.admitted < 5
         returning c.admitted`,
      [testClientHash()],
    );

    const plan = rows.map((row) => row["QUERY PLAN"]).join("\n");
    expect(plan, "no read of this table may be a scan").not.toMatch(/Seq Scan/);

    const { rows: sizes } = await admin.query<{ total: number }>(
      `select count(*)::int as total from ${COUNTERS}`,
    );
    expect(sizes[0]?.total).toBeGreaterThan(19_000);
  });
});
