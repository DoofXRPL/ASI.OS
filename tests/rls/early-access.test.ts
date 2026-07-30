import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asAnon,
  asUser,
  connect,
  createUser,
  expectDenied,
  type TestUser,
} from "./harness";

/**
 * The front door, proven shut.
 *
 * `access.early_access_requests` inverts the model the rest of the schema
 * uses. There is no `user_id` to key a policy to, because the writer is a
 * stranger. What replaces ownership is reachability: the table is in a schema
 * PostgREST does not expose, no API role holds any privilege on it, and the
 * only way in is one SECURITY DEFINER function that returns nothing.
 *
 * So these tests are mostly about what cannot be done. Each of them is paired
 * with the positive control that the function itself still works — without
 * that pairing, a front door that was simply broken would pass every one.
 *
 * See supabase/migrations/0003_early_access.sql and
 * docs/DECISIONS/0008-the-front-door-is-its-own-schema.md.
 */

const QUEUE = "access.early_access_requests";
const RPC = "public.request_early_access(text, text, text, text, text, text, text)";

/** Named arguments, so a reordered signature fails loudly rather than silently. */
const REQUEST = `public.request_early_access(
  p_name => $1, p_email => $2, p_use_case => $3,
  p_company => $4, p_other_use_case => $5, p_team_size => $6, p_challenge => $7
)`;

const VALID: [string, string, string, string | null, string | null, string | null, string | null] =
  ["Ada Lovelace", "ada@example.com", "research", "Analytical Engines", null, "just_me", "Context is lost between sessions."];

let admin: Client;
let member: TestUser;

beforeAll(async () => {
  admin = await connect();
  member = await createUser(admin, "early-access-member@asi.test", "Member");
});

afterAll(async () => {
  await admin?.end();
});

async function countRows(): Promise<number> {
  const { rows } = await admin.query<{ total: string }>(
    `select count(*)::int as total from ${QUEUE}`,
  );
  return Number(rows[0]?.total ?? -1);
}

describe("the access schema is not part of the user data plane", () => {
  it("holds exactly the intake table and nothing else", async () => {
    const { rows } = await admin.query<{ tablename: string }>(
      `select c.relname as tablename
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'access' and c.relkind = 'r'
       order by c.relname`,
    );

    expect(rows.map((r) => r.tablename)).toEqual(["early_access_requests"]);
  });

  it("matches the column shape the application types expect", async () => {
    const { rows } = await admin.query<{ column_name: string }>(
      `select column_name
       from information_schema.columns
       where table_schema = 'access' and table_name = 'early_access_requests'
       order by column_name`,
    );

    expect(rows.map((r) => r.column_name)).toEqual([
      "challenge",
      "company",
      "created_at",
      "email",
      "id",
      "name",
      "other_use_case",
      "status",
      "team_size",
      "use_case",
    ]);
  });

  it("carries no user_id, because a request has no owner", async () => {
    const { rows } = await admin.query(
      `select column_name
       from information_schema.columns
       where table_schema = 'access' and column_name = 'user_id'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("enables row level security with no policy to satisfy", async () => {
    const { rows: table } = await admin.query<{ enabled: boolean }>(
      `select c.relrowsecurity as enabled
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'access' and c.relname = 'early_access_requests'`,
    );
    expect(rows(table).enabled).toBe(true);

    const { rows: policies } = await admin.query(
      "select policyname from pg_policies where schemaname = 'access'",
    );
    expect(policies).toHaveLength(0);
  });

  it("gives no API role access to the schema or the table", async () => {
    for (const role of ["anon", "authenticated"]) {
      const { rows: schema } = await admin.query<{ allowed: boolean }>(
        "select has_schema_privilege($1, 'access', 'USAGE') as allowed",
        [role],
      );
      expect(rows(schema).allowed, `${role} must not reach the access schema`).toBe(false);

      const { rows: table } = await admin.query<{ allowed: boolean }>(
        `select bool_or(has_table_privilege($1, $2, priv)) as allowed
         from unnest(array['SELECT','INSERT','UPDATE','DELETE']) as priv`,
        [role, QUEUE],
      );
      expect(rows(table).allowed, `${role} must hold no privilege on the queue`).toBe(false);
    }
  });
});

describe("the request function is the only way in", () => {
  it("lets an unauthenticated visitor record a request", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await query(`select ${REQUEST}`, VALID);

      const { rows } = await inspect<{ name: string; email: string; status: string }>(
        `select name, email, status from ${QUEUE} where email = 'ada@example.com'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe("Ada Lovelace");
      expect(rows[0]?.status).toBe("new");
    });
  });

  it("lets a signed-in visitor record one too, without attributing it to them", async () => {
    await asUser(admin, member, async ({ query, inspect }) => {
      await query(`select ${REQUEST}`, [
        "Signed In",
        "signed-in@example.com",
        "software_development",
        null,
        null,
        null,
        null,
      ]);

      const { rows } = await inspect(
        `select id from ${QUEUE} where email = 'signed-in@example.com'`,
      );
      expect(rows).toHaveLength(1);
    });
  });

  it("returns nothing, so it cannot report whether an address is already listed", async () => {
    const { rows } = await admin.query<{ returns: string; kind: string; definer: boolean }>(
      `select pg_get_function_result(p.oid) as returns,
              p.prokind as kind,
              p.prosecdef as definer
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'request_early_access'`,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.returns).toBe("void");
    expect(rows[0]?.definer).toBe(true);
  });

  it("pins its search_path, as every function in this project must", async () => {
    const { rows } = await admin.query<{ config: string[] | null }>(
      `select p.proconfig as config
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'request_early_access'`,
    );
    expect(rows[0]?.config?.some((entry) => entry.startsWith("search_path="))).toBe(true);
  });

  it("refuses to read the queue back, even to the role that can write to it", async () => {
    await asAnon(admin, async ({ query }) => {
      const denial = await expectDenied(() => query(`select * from ${QUEUE}`));
      // 42501 = insufficient_privilege, raised by the missing USAGE on the schema.
      expect(denial.code).toBe("42501");
    });
  });

  it("refuses a direct insert, so the function cannot be bypassed", async () => {
    await asAnon(admin, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `insert into ${QUEUE} (name, email, use_case)
           values ('Direct', 'direct@example.com', 'research')`,
        ),
      );
      expect(denial.code).toBe("42501");
    });
  });

  it("refuses an update or a delete from an authenticated account", async () => {
    // One transaction per statement: the first denial aborts the transaction,
    // and every later statement in it would then fail for that reason instead
    // of the one under test.
    for (const statement of [
      `update ${QUEUE} set status = 'invited'`,
      `delete from ${QUEUE}`,
    ]) {
      await asUser(admin, member, async ({ query }) => {
        const denial = await expectDenied(() => query(statement));
        expect(denial.code, statement).toBe("42501");
      });
    }
  });
});

describe("what the database will and will not record", () => {
  it("absorbs a second request from the same address without a word", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await query(`select ${REQUEST}`, VALID);
      // Different everything except the address. No error, and no overwrite:
      // the first answer is the one that was given first.
      await query(`select ${REQUEST}`, [
        "Someone Else",
        "ADA@example.com",
        "finance",
        null,
        null,
        null,
        null,
      ]);

      const { rows } = await inspect<{ name: string; use_case: string }>(
        `select name, use_case from ${QUEUE} where email = 'ada@example.com'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe("Ada Lovelace");
      expect(rows[0]?.use_case).toBe("research");
    });
  });

  it("stores the address folded to lower case, so the address is the identity", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await query(`select ${REQUEST}`, [
        "Mixed Case",
        "  Mixed.Case@Example.COM ",
        "research",
        null,
        null,
        null,
        null,
      ]);

      const { rows } = await inspect<{ email: string }>(
        `select email from ${QUEUE} where name = 'Mixed Case'`,
      );
      expect(rows[0]?.email).toBe("mixed.case@example.com");
    });
  });

  it("turns blank optional answers into nothing rather than empty strings", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await query(`select ${REQUEST}`, [
        "Blanks",
        "blanks@example.com",
        "research",
        "   ",
        "",
        "  ",
        "",
      ]);

      const { rows } = await inspect<{
        company: string | null;
        team_size: string | null;
        challenge: string | null;
      }>(`select company, team_size, challenge from ${QUEUE} where name = 'Blanks'`);

      expect(rows[0]).toEqual({ company: null, team_size: null, challenge: null });
    });
  });

  it("rejects a use case it does not know", async () => {
    await asAnon(admin, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(`select ${REQUEST}`, [
          "Unknown",
          "unknown@example.com",
          "world_domination",
          null,
          null,
          null,
          null,
        ]),
      );
      // 23514 = check_violation, from early_access_use_case_known.
      expect(denial.code).toBe("23514");
    });
  });

  it("requires an explanation when the use case is 'other'", async () => {
    await asAnon(admin, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(`select ${REQUEST}`, [
          "Other",
          "other@example.com",
          "other",
          null,
          null,
          null,
          null,
        ]),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("refuses an explanation attached to a category that is not 'other'", async () => {
    await asAnon(admin, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(`select ${REQUEST}`, [
          "Mismatch",
          "mismatch@example.com",
          "research",
          null,
          "This describes something else entirely.",
          null,
          null,
        ]),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("accepts 'other' when it says what it means", async () => {
    await asAnon(admin, async ({ query, inspect }) => {
      await query(`select ${REQUEST}`, [
        "Other",
        "other@example.com",
        "other",
        null,
        "Coordinating a research group's reading and decisions.",
        null,
        null,
      ]);

      const { rows } = await inspect<{ other_use_case: string }>(
        `select other_use_case from ${QUEUE} where email = 'other@example.com'`,
      );
      expect(rows[0]?.other_use_case).toContain("research group");
    });
  });

  it("rejects a team size it does not know", async () => {
    await asAnon(admin, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(`select ${REQUEST}`, [
          "Bad size",
          "size@example.com",
          "research",
          null,
          null,
          "a_few_hundred",
          null,
        ]),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("rejects an address that is obviously not one", async () => {
    for (const email of ["nope", "no@domain", "two@@at.com", "spaced out@example.com"]) {
      await asAnon(admin, async ({ query }) => {
        const denial = await expectDenied(() =>
          query(`select ${REQUEST}`, ["Bad", email, "research", null, null, null, null]),
        );
        expect(denial.code, `"${email}" should be refused`).toBe("23514");
      });
    }
  });

  it("rejects a blank name and an over-long one", async () => {
    for (const name of ["   ", "n".repeat(121)]) {
      await asAnon(admin, async ({ query }) => {
        const denial = await expectDenied(() =>
          query(`select ${REQUEST}`, [name, "long@example.com", "research", null, null, null, null]),
        );
        expect(denial.code).toBe("23514");
      });
    }
  });

  it("rejects a triage status nothing knows how to read", async () => {
    const denial = await expectDenied(() =>
      admin.query(
        `insert into ${QUEUE} (name, email, use_case, status)
         values ('Bad status', 'status@example.com', 'research', 'pondering')`,
      ),
    );
    expect(denial.code).toBe("23514");
  });

  it("leaves nothing behind when a request is refused", async () => {
    const before = await countRows();

    await asAnon(admin, async ({ query }) => {
      await expectDenied(() =>
        query(`select ${REQUEST}`, ["Refused", "nope", "research", null, null, null, null]),
      );
    });

    expect(await countRows()).toBe(before);
  });

  it("holds the execute privilege open to exactly the two API roles", async () => {
    for (const role of ["anon", "authenticated"]) {
      const { rows } = await admin.query<{ allowed: boolean }>(
        "select has_function_privilege($1, $2, 'EXECUTE') as allowed",
        [role, RPC],
      );
      expect(rows[0]?.allowed, `${role} must be able to submit a request`).toBe(true);
    }
  });
});

/** Narrows the single row a `select ... where` of this kind always returns. */
function rows<T>(result: T[]): T {
  const row = result[0];
  if (row === undefined) throw new Error("Expected exactly one row.");
  return row;
}
