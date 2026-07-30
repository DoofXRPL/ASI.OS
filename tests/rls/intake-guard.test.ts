import { createHash } from "node:crypto";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asAnon,
  asUser,
  connect,
  createUser,
  expectDenied,
  registerIntakeKey,
  testClientHash,
  type TestUser,
} from "./harness";

/**
 * The lock and the meter on the front door.
 *
 * Everything the Server Action does — the honeypot, the schema, the body limit,
 * the token bucket in the proxy — protects the path a visitor takes. An attacker
 * does not have to take it: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is published,
 * and with it anybody can post straight to
 * `/rest/v1/rpc/request_early_access`. So the two rules that matter live in the
 * database, and this suite is the reason to believe they are there.
 *
 * Every test runs as `anon`, because that is who a stranger is. Where a test
 * needs to change the thresholds it does so through `inspect`, inside the
 * transaction the harness rolls back, so no test can tune the door for another.
 *
 * One thing this suite cannot see, by construction: it submits on a single
 * connection, so it observes its own uncommitted work and a limit that is read
 * and then acted on looks perfect to it. That is what intake-concurrency.test.ts
 * is for.
 *
 * See supabase/migrations/0004_intake_guard.sql,
 * supabase/migrations/0005_intake_meter_is_atomic.sql and docs/SECURITY.md.
 */

const KEY = "intake-guard-suite-key-0123456789abcdef";
const COUNTERS = "access.intake_counters";
const QUEUE = "access.early_access_requests";

/**
 * A submission with the answers fixed and the caller and key given per test,
 * since those are what this suite is about.
 */
const REQUEST = `public.request_early_access(
  p_key => $1, p_client => $2,
  p_name => 'Ada Lovelace', p_email => $3, p_use_case => 'research'
)`;

let admin: Client;
let member: TestUser;

beforeAll(async () => {
  admin = await connect();
  member = await createUser(admin, "intake-guard-member@asi.test", "Member");
  await registerIntakeKey(admin, KEY, "intake-guard-suite");
});

afterAll(async () => {
  await admin?.end();
});

/** One submission, returning whatever the door said about it. */
async function submit(
  query: <T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>,
  options: { key?: string; client?: string; email?: string } = {},
): Promise<string> {
  const { rows } = await query<{ outcome: string }>(`select ${REQUEST} as outcome`, [
    options.key ?? KEY,
    options.client ?? testClientHash(),
    options.email ?? `visitor-${Math.random().toString(36).slice(2)}@example.com`,
  ]);
  return String(rows[0]?.outcome);
}

describe("the key is what tells this deployment from everybody else", () => {
  it("lets a recognised caller through", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      expect(await submit(query, { email: "recognised@example.com" })).toBe("accepted");

      const { rows } = await inspect(
        `select id from ${QUEUE} where email = 'recognised@example.com'`,
      );
      expect(rows).toHaveLength(1);
    });
  });

  it("refuses a caller holding only the publishable key", async () => {
    // The whole point. Reaching the function is not the same as being allowed to
    // use it, and this is the request an attacker can actually make.
    await asAnon(admin, async ({ query, inspect }) => {
      expect(await submit(query, { key: "", email: "nokey@example.com" })).toBe("refused");
      expect(await submit(query, { key: "guessed", email: "nokey@example.com" })).toBe(
        "refused",
      );

      const { rows } = await inspect(`select id from ${QUEUE} where email = 'nokey@example.com'`);
      expect(rows).toHaveLength(0);
    });
  });

  it("refuses a key that has been retired", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await inspect("update access.intake_keys set retired_at = now()");

      // Retired, not deleted: the record that it existed survives, and the
      // rotation it belongs to can still be read afterwards.
      expect(await submit(query)).toBe("unconfigured");
    });
  });

  it("refuses everything when no key has been registered at all", async () => {
    // The state of a deployment nobody configured. Failing closed here is what
    // makes forgetting the environment variable visible instead of silent.
    await asAnon(admin, async ({ query, inspect }) => {
      await inspect("delete from access.intake_keys");

      expect(await submit(query)).toBe("unconfigured");
    });
  });

  it("stores digests rather than keys, and the digest is the one Node computes", async () => {
    const { rows } = await admin.query<{ matches: boolean }>(
      `select key_sha256 = decode($1, 'hex') as matches
       from access.intake_keys where label = 'intake-guard-suite'`,
      [createHash("sha256").update(KEY, "utf8").digest("hex")],
    );

    expect(rows[0]?.matches, "the two halves of the key must agree on the digest").toBe(true);

    const { rows: columns } = await admin.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'access' and table_name = 'intake_keys'
       order by column_name`,
    );
    expect(columns.map((c) => c.column_name)).toEqual([
      "created_at",
      "id",
      "key_sha256",
      "label",
      "retired_at",
    ]);
  });

  it("accepts several live keys at once, so rotation is not an outage", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      const next = "intake-guard-rotated-key-0123456789abcdef";
      await inspect(
        `insert into access.intake_keys (label, key_sha256) values ('rotated', decode($1, 'hex'))`,
        [createHash("sha256").update(next, "utf8").digest("hex")],
      );

      expect(await submit(query, { key: KEY })).toBe("accepted");
      expect(await submit(query, { key: next })).toBe("accepted");
    });
  });
});

describe("a caller the meter cannot count is not served", () => {
  const unusable = [
    ["an empty identifier", ""],
    ["an address, which is what this refuses to store", "203.0.113.7"],
    // Exactly the right length, so only the character set can refuse it.
    ["an address padded to the length of a digest", `${"0".repeat(21)}203.0.113.7`],
    ["too few characters", "a".repeat(31)],
    ["too many characters", "a".repeat(33)],
    ["something that is not hexadecimal at all", "z".repeat(32)],
  ] as const;

  for (const [description, client] of unusable) {
    it(`refuses ${description}`, async () => {
      await asAnon(admin, async ({ query, inspect }) => {
        expect(await submit(query, { client, email: "unmetered@example.com" })).toBe("refused");

        const { rows } = await inspect(
          `select id from ${QUEUE} where email = 'unmetered@example.com'`,
        );
        expect(rows, "an unmeterable request is an unlimited one").toHaveLength(0);
      });
    });
  }

  it("reads the same digest in either case as the same caller", async () => {
    // Folding the case is what stops re-sending the same digest in capitals from
    // being a second budget.
    await asAnon(admin, async ({ query, inspect }) => {
      await inspect("update access.intake_limits set per_client_max = 1");
      const client = testClientHash();

      expect(await submit(query, { client })).toBe("accepted");
      expect(await submit(query, { client: client.toUpperCase() })).toBe("throttled");
    });
  });

  it("cannot be made to store an address even by writing one directly", async () => {
    // The privacy promise is a check constraint, not a convention in the calling
    // code. This is the test that makes it one.
    for (const bucket of ["203.0.113.7", "2001:db8::1", "203.0.113.0/24", "2001:db8::/64"]) {
      const denial = await expectDenied(() =>
        admin.query(`insert into ${COUNTERS} (bucket, window_start) values ($1, now())`, [bucket]),
      );
      expect(denial.code, `${bucket} must not be storable`).toBe("23514");
    }
  });

  it("records nothing but a bucket, a window and two counts", async () => {
    const { rows } = await admin.query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'access' and table_name = 'intake_counters'
       order by column_name`,
    );

    expect(rows.map((c) => c.column_name)).toEqual([
      "admitted",
      "bucket",
      "refused",
      "window_start",
    ]);
  });

  it("has no table left that records one row per call", async () => {
    // 0004's `intake_attempts` was what made counting grow with the flood it was
    // meant to absorb. Its absence is the guarantee.
    const { rows } = await admin.query<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'access' order by table_name`,
    );
    expect(rows.map((r) => r.table_name)).toEqual([
      "early_access_requests",
      "intake_counters",
      "intake_keys",
      "intake_limits",
    ]);
  });
});

describe("the meter, per caller", () => {
  async function setLimit(
    inspect: (sql: string, params?: unknown[]) => Promise<unknown>,
    columns: Record<string, string>,
  ): Promise<void> {
    const assignments = Object.entries(columns)
      .map(([column, value]) => `${column} = ${value}`)
      .join(", ");
    await inspect(`update access.intake_limits set ${assignments}`);
  }

  it("accepts up to the limit and then refuses", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await setLimit(inspect, { per_client_max: "3" });
      const client = testClientHash();

      for (let attempt = 1; attempt <= 3; attempt += 1) {
        expect(await submit(query, { client }), `attempt ${attempt}`).toBe("accepted");
      }

      expect(await submit(query, { client })).toBe("throttled");
    });
  });

  it("counts one caller separately from another", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await setLimit(inspect, { per_client_max: "1" });

      expect(await submit(query, { client: testClientHash() })).toBe("accepted");
      expect(await submit(query, { client: testClientHash() })).toBe("accepted");
    });
  });

  it("forgets a caller once their window has passed", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await setLimit(inspect, { per_client_max: "1", per_client_window: "interval '1 minute'" });
      const client = testClientHash();

      expect(await submit(query, { client })).toBe("accepted");
      expect(await submit(query, { client })).toBe("throttled");

      // A window is a row, so the next one starts at nothing. Moving this row
      // back is the same thing as a minute passing.
      await inspect(
        `update ${COUNTERS} set window_start = window_start - interval '2 minutes'
          where bucket = $1`,
        [client],
      );

      expect(await submit(query, { client })).toBe("accepted");
    });
  });

  it("records a caller who keeps knocking without letting it raise their count", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await setLimit(inspect, { per_client_max: "1", per_client_window: "interval '1 hour'" });
      const client = testClientHash();

      await submit(query, { client });
      expect(await submit(query, { client })).toBe("throttled");
      expect(await submit(query, { client })).toBe("throttled");

      const { rows } = await inspect<{ admitted: number; refused: number }>(
        `select admitted, refused from ${COUNTERS} where bucket = $1`,
        [client],
      );

      // The refusals are written down and read by nothing. Recorded because a
      // sustained refusal rate is the signal worth looking at; not counted,
      // because a refusal that raised the count would be its own next reason.
      expect(rows).toEqual([{ admitted: 1, refused: 2 }]);
    });
  });

  it("writes nothing to the queue when it refuses", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await setLimit(inspect, { per_client_max: "1" });
      const client = testClientHash();

      await submit(query, { client, email: "first@example.com" });
      expect(await submit(query, { client, email: "second@example.com" })).toBe("throttled");

      const { rows } = await inspect(`select id from ${QUEUE} where email = 'second@example.com'`);
      expect(rows).toHaveLength(0);
    });
  });

  it("refuses a signed-in visitor on the same terms as a stranger", async () => {
    // The queue does not belong to an account, so having one buys nothing here.
    await asUser(admin, member, async ({ query, inspect }) => {
      await inspect("update access.intake_limits set per_client_max = 1");
      const client = testClientHash();

      expect(await submit(query, { client })).toBe("accepted");
      expect(await submit(query, { client })).toBe("throttled");
    });
  });
});

describe("the meter, across the deployment", () => {
  it("stops accepting once the whole door is over its limit", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await inspect("update access.intake_limits set global_max = 2, per_client_max = 100");

      expect(await submit(query, { client: testClientHash() })).toBe("accepted");
      expect(await submit(query, { client: testClientHash() })).toBe("accepted");

      // A caller who has done nothing wrong, refused because the deployment has.
      // That is the trade a global ceiling makes, and it is the right way round:
      // a flood that gets through is worse than a request that waits.
      expect(await submit(query, { client: testClientHash() })).toBe("throttled");
    });
  });

  it("is unconfigured, rather than unlimited, with no thresholds to read", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await inspect("delete from access.intake_limits");

      expect(await submit(query)).toBe("unconfigured");
    });
  });

  it("will not be configured into having no limit at all", async () => {
    for (const [column, value] of [
      ["per_client_max", "0"],
      ["global_max", "0"],
      ["per_client_window", "interval '1 second'"],
      ["retain_counters", "interval '1 minute'"],
    ] as const) {
      const denial = await expectDenied(() =>
        admin.query(`update access.intake_limits set ${column} = ${value}`),
      );
      expect(denial.code, `${column} = ${value} should be refused`).toBe("23514");
    }
  });

  it("holds exactly one row of thresholds, so there is one door", async () => {
    const denial = await expectDenied(() =>
      admin.query("insert into access.intake_limits (id) values (true)"),
    );
    // 23505 = unique_violation, from the singleton primary key.
    expect(denial.code).toBe("23505");
  });
});

describe("the meter forgets", () => {
  it("prunes windows older than the retention it was given", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      const stale = testClientHash();
      await inspect(
        `insert into ${COUNTERS} (bucket, window_start, admitted)
         values ($1, now() - interval '48 hours', 1)`,
        [stale],
      );

      await submit(query);

      const { rows } = await inspect(`select admitted from ${COUNTERS} where bucket = $1`, [
        stale,
      ]);
      expect(rows, "a counter is not a log").toHaveLength(0);
    });
  });
});

describe("none of this machinery is reachable from outside the function", () => {
  const tables = ["access.intake_keys", "access.intake_limits", COUNTERS];

  it("refuses a read of the keys, the thresholds or the counters", async () => {
    for (const table of tables) {
      await asAnon(admin, async ({ query }) => {
        const denial = await expectDenied(() => query(`select * from ${table}`));
        // 42501 = insufficient_privilege, from the missing USAGE on the schema.
        expect(denial.code, `${table} must not be readable`).toBe("42501");
      });
    }
  });

  it("refuses a write, so a caller cannot register their own key or raise the limit", async () => {
    const writes = [
      `insert into access.intake_keys (label, key_sha256) values ('mine', sha256('x'::bytea))`,
      "update access.intake_limits set per_client_max = 1000000",
      `delete from ${COUNTERS}`,
    ];

    for (const statement of writes) {
      await asUser(admin, member, async ({ query }) => {
        const denial = await expectDenied(() => query(statement));
        expect(denial.code, statement).toBe("42501");
      });
    }
  });

  it("enables row level security on all three, with no policy to satisfy", async () => {
    for (const table of tables) {
      const { rows } = await admin.query<{ enabled: boolean }>(
        `select c.relrowsecurity as enabled
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'access' and c.relname = $1`,
        [table.split(".")[1]],
      );
      expect(rows[0]?.enabled, `${table} must have RLS enabled`).toBe(true);
    }

    const { rows: policies } = await admin.query(
      "select policyname from pg_policies where schemaname = 'access'",
    );
    expect(policies).toHaveLength(0);
  });
});
