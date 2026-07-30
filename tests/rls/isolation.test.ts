import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  asUser,
  connect,
  createUser,
  expectDenied,
  type TestUser,
} from "./harness";

/**
 * These tests are the reason this project can claim privacy.
 *
 * Row Level Security is the ONLY isolation boundary in ASI OS, so it is proven
 * against a real PostgreSQL database with real policies and two real accounts —
 * never against mocks. A previous project this one learned from tested an
 * in-memory array and an email allowlist, and therefore proved nothing about
 * what the database would actually do.
 *
 * Every test that asserts a denial is paired with a positive control asserting
 * the owner CAN reach their own row. Without that pairing, a policy that denied
 * everyone would pass the whole suite.
 */

const USER_TABLES = [
  "profiles",
  "user_settings",
  "activity_events",
  "projects",
  "inbox_items",
] as const;

let admin: Client;
let alice: TestUser;
let bob: TestUser;

/** Rows committed as the table owner, so the other user has something to fail to reach. */
let aliceActivityId: string;
let bobActivityId: string;

beforeAll(async () => {
  admin = await connect();

  alice = await createUser(admin, "alice@asi.test", "Alice");
  bob = await createUser(admin, "bob@asi.test", "Bob");

  aliceActivityId = await seedActivity(alice, "alice private event");
  bobActivityId = await seedActivity(bob, "bob private event");
});

afterAll(async () => {
  await admin?.end();
});

async function seedActivity(user: TestUser, summary: string): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    `insert into public.activity_events (user_id, event_type, summary)
     values ($1, 'test.seed', $2)
     returning id`,
    [user.id, summary],
  );
  const row = rows[0];
  if (!row) throw new Error("Failed to seed activity event");
  return row.id;
}

describe("account provisioning", () => {
  it("creates exactly one profile and one settings row per account", async () => {
    const { rows } = await admin.query<{ profiles: string; settings: string }>(
      `select
         (select count(*) from public.profiles where user_id = $1) as profiles,
         (select count(*) from public.user_settings where user_id = $1) as settings`,
      [alice.id],
    );
    expect(rows[0]).toEqual({ profiles: "1", settings: "1" });
  });

  it("reads the display name from signup metadata without inventing one", async () => {
    const { rows } = await admin.query<{ display_name: string | null }>(
      "select display_name from public.profiles where user_id = $1",
      [alice.id],
    );
    expect(rows[0]?.display_name).toBe("Alice");
  });

  it("leaves the display name null when signup metadata has none", async () => {
    const carol = await createUser(admin, "carol@asi.test");
    const { rows } = await admin.query<{ display_name: string | null }>(
      "select display_name from public.profiles where user_id = $1",
      [carol.id],
    );
    expect(rows[0]?.display_name).toBeNull();
  });

  it("makes the first account the owner and no later account an owner", async () => {
    // Asserted by creation order rather than by a specific address, because
    // other suites in this run also create accounts. The rule under test is
    // "the earliest account, whichever it is", and exactly one of them.
    const { rows } = await admin.query<{ email: string; is_owner: boolean }>(
      `select u.email, p.is_owner
       from public.profiles p
       join auth.users u on u.id = p.user_id
       order by p.created_at, u.email`,
    );
    expect(rows[0]?.is_owner).toBe(true);
    expect(rows.filter((r) => r.is_owner)).toHaveLength(1);
    expect(rows.length).toBeGreaterThan(1);
  });

  it("refuses a second owner at the database level", async () => {
    const denial = await expectDenied(() =>
      admin.query("update public.profiles set is_owner = true where user_id = $1", [
        bob.id,
      ]),
    );
    // 23505 = unique_violation, from the partial unique index on is_owner.
    expect(denial.code).toBe("23505");
  });

  it("cascades every owned row when the account is deleted", async () => {
    const doomed = await createUser(admin, "doomed@asi.test");
    await admin.query(
      `insert into public.activity_events (user_id, event_type, summary)
       values ($1, 'test.seed', 'doomed event')`,
      [doomed.id],
    );
    const { rows: projectRows } = await admin.query<{ id: string }>(
      "insert into public.projects (user_id, name) values ($1, 'Doomed') returning id",
      [doomed.id],
    );
    await admin.query(
      `insert into public.inbox_items (user_id, content, project_id)
       values ($1, 'doomed capture', $2)`,
      [doomed.id, projectRows[0]?.id],
    );

    await admin.query("delete from auth.users where id = $1", [doomed.id]);

    const { rows } = await admin.query<{ total: string }>(
      `select
         (select count(*) from public.profiles where user_id = $1)::int
       + (select count(*) from public.user_settings where user_id = $1)::int
       + (select count(*) from public.activity_events where user_id = $1)::int
       + (select count(*) from public.projects where user_id = $1)::int
       + (select count(*) from public.inbox_items where user_id = $1)::int
       as total`,
      [doomed.id],
    );
    expect(rows[0]?.total).toBe(0);
  });
});

describe("schema-wide guarantees", () => {
  it("defines exactly the schemas this project knows about", async () => {
    // Everything below asserts something about `public`. That is only a
    // guarantee about the database if `public` is where the tables are, so the
    // set of schemas is pinned too: a table hidden in an unlisted schema would
    // otherwise inherit none of these rules and fail none of these tests.
    const { rows } = await admin.query<{ nspname: string }>(
      `select nspname from pg_namespace
       where nspname not like 'pg\\_%' and nspname <> 'information_schema'
       order by nspname`,
    );

    expect(rows.map((r) => r.nspname)).toEqual(["access", "auth", "public"]);
  });

  it("enables row level security on every table in the public schema", async () => {
    const { rows } = await admin.query<{ tablename: string; enabled: boolean }>(
      `select c.relname as tablename, c.relrowsecurity as enabled
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r'
       order by c.relname`,
    );

    expect(rows.map((r) => r.tablename)).toEqual([...USER_TABLES].sort());
    for (const row of rows) {
      expect(row.enabled, `${row.tablename} must have RLS enabled`).toBe(true);
    }
  });

  it("requires a non-nullable user_id on every table in the public schema", async () => {
    const { rows } = await admin.query<{ tablename: string; is_nullable: string }>(
      `select table_name as tablename, is_nullable
       from information_schema.columns
       where table_schema = 'public' and column_name = 'user_id'
       order by table_name`,
    );

    expect(rows.map((r) => r.tablename)).toEqual([...USER_TABLES].sort());
    for (const row of rows) {
      expect(row.is_nullable, `${row.tablename}.user_id must be NOT NULL`).toBe("NO");
    }
  });

  it("matches the column shape the application types expect", async () => {
    // Guards against drift between supabase/migrations and
    // lib/supabase/database.types.ts, which TypeScript alone cannot catch.
    const expected: Record<(typeof USER_TABLES)[number], string[]> = {
      activity_events: [
        "actor",
        "created_at",
        "detail",
        "event_type",
        "id",
        "occurred_at",
        "subject_id",
        "subject_type",
        "summary",
        "user_id",
      ],
      profiles: [
        "created_at",
        "display_name",
        "id",
        "is_owner",
        "timezone",
        "updated_at",
        "user_id",
      ],
      user_settings: ["created_at", "id", "settings", "updated_at", "user_id"],
      projects: [
        "blocked_reason",
        "created_at",
        "id",
        "last_touched_at",
        "name",
        "next_action",
        "outcome",
        "status",
        "updated_at",
        "user_id",
      ],
      inbox_items: [
        "content",
        "created_at",
        "id",
        "kind",
        "processed_at",
        "processed_into",
        "project_id",
        "source",
        "status",
        "updated_at",
        "user_id",
      ],
    };

    for (const table of USER_TABLES) {
      const { rows } = await admin.query<{ column_name: string }>(
        `select column_name
         from information_schema.columns
         where table_schema = 'public' and table_name = $1
         order by column_name`,
        [table],
      );
      expect(
        rows.map((r) => r.column_name),
        `columns of ${table} changed`,
      ).toEqual(expected[table]);
    }
  });

  it("grants the anon role no access to any user table", async () => {
    for (const table of USER_TABLES) {
      const { rows } = await admin.query<{ allowed: boolean }>(
        `select bool_or(has_table_privilege('anon', $1, priv)) as allowed
         from unnest(array['SELECT','INSERT','UPDATE','DELETE']) as priv`,
        [`public.${table}`],
      );
      expect(rows[0]?.allowed, `anon must have no privileges on ${table}`).toBe(false);
    }
  });

  it("pins search_path on every function it defines", async () => {
    // Extension-owned functions are excluded: we do not control their
    // definitions. ASI OS installs no extensions, so today this is defensive.
    const { rows } = await admin.query<{ proname: string; config: string[] | null }>(
      `select p.proname, p.proconfig as config
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
         and not exists (
           select 1 from pg_depend d
           where d.objid = p.oid and d.deptype = 'e'
         )
       order by p.proname`,
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(
        row.config?.some((c) => c.startsWith("search_path=")),
        `${row.proname} must pin search_path`,
      ).toBe(true);
    }
  });

  it("keeps the provisioning function unreachable from API roles", async () => {
    for (const role of ["anon", "authenticated"]) {
      const { rows } = await admin.query<{ allowed: boolean }>(
        "select has_function_privilege($1, 'public.handle_new_user()', 'EXECUTE') as allowed",
        [role],
      );
      expect(rows[0]?.allowed, `${role} must not execute handle_new_user`).toBe(false);
    }
  });
});

describe("profiles isolation", () => {
  it("lets a user read their own profile", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rows } = await query("select user_id from public.profiles");
      expect(rows).toHaveLength(1);
      expect(rows[0]?.user_id).toBe(alice.id);
    });
  });

  it("hides another user's profile entirely", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const { rows } = await query(
        "select user_id from public.profiles where user_id = $1",
        [alice.id],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("lets a user rename themselves", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rowCount } = await query(
        "update public.profiles set display_name = 'Renamed' where user_id = $1",
        [alice.id],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("silently affects no rows when renaming another user", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const { rowCount } = await query(
        "update public.profiles set display_name = 'Hacked' where user_id = $1",
        [alice.id],
      );
      expect(rowCount).toBe(0);
    });

    const { rows } = await admin.query<{ display_name: string | null }>(
      "select display_name from public.profiles where user_id = $1",
      [alice.id],
    );
    expect(rows[0]?.display_name).toBe("Alice");
  });

  it("rejects inserting a profile owned by someone else", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("insert into public.profiles (user_id) values ($1)", [alice.id]),
      );
      // 42501 = insufficient_privilege, raised when a WITH CHECK policy fails.
      expect(denial.code).toBe("42501");
    });
  });

  it("prevents a user from granting themselves owner", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("update public.profiles set is_owner = true where user_id = $1", [bob.id]),
      );
      expect(denial.code).toBe("42501");
    });

    const { rows } = await admin.query<{ is_owner: boolean }>(
      "select is_owner from public.profiles where user_id = $1",
      [bob.id],
    );
    expect(rows[0]?.is_owner).toBe(false);
  });

  it("gives no user the ability to delete a profile", async () => {
    const { rows } = await admin.query<{ allowed: boolean }>(
      "select has_table_privilege('authenticated', 'public.profiles', 'DELETE') as allowed",
    );
    expect(rows[0]?.allowed).toBe(false);
  });
});

describe("user_settings isolation", () => {
  it("lets a user read and write their own settings", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const read = await query("select settings from public.user_settings");
      expect(read.rows).toHaveLength(1);

      const written = await query(
        `update public.user_settings set settings = '{"theme":"calm"}'::jsonb
         where user_id = $1`,
        [alice.id],
      );
      expect(written.rowCount).toBe(1);
    });
  });

  it("hides another user's settings", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const { rows } = await query(
        "select settings from public.user_settings where user_id = $1",
        [alice.id],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("affects no rows when writing another user's settings", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const { rowCount } = await query(
        `update public.user_settings set settings = '{"stolen":true}'::jsonb
         where user_id = $1`,
        [alice.id],
      );
      expect(rowCount).toBe(0);
    });
  });

  it("rejects settings that are not a JSON object", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          "update public.user_settings set settings = '[]'::jsonb where user_id = $1",
          [alice.id],
        ),
      );
      // 23514 = check_violation, from user_settings_is_object.
      expect(denial.code).toBe("23514");
    });
  });
});

describe("activity_events isolation and immutability", () => {
  it("lets a user read only their own history", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rows } = await query<{ id: string; summary: string }>(
        "select id, summary from public.activity_events",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(aliceActivityId);
      expect(rows[0]?.summary).toBe("alice private event");
    });
  });

  it("hides another user's history even when the row id is known", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rows } = await query("select id from public.activity_events where id = $1", [
        bobActivityId,
      ]);
      expect(rows).toHaveLength(0);
    });
  });

  it("lets a user append to their own history", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rowCount } = await query(
        `insert into public.activity_events (user_id, event_type, summary)
         values ($1, 'test.append', 'appended by alice')`,
        [alice.id],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("rejects writing history attributed to another user", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `insert into public.activity_events (user_id, event_type, summary)
           values ($1, 'test.forged', 'forged by bob')`,
          [alice.id],
        ),
      );
      expect(denial.code).toBe("42501");
    });
  });

  it("denies UPDATE and DELETE privileges to authenticated users", async () => {
    for (const privilege of ["UPDATE", "DELETE"]) {
      const { rows } = await admin.query<{ allowed: boolean }>(
        "select has_table_privilege('authenticated', 'public.activity_events', $1) as allowed",
        [privilege],
      );
      expect(rows[0]?.allowed, `activity_events must not be ${privilege}-able`).toBe(
        false,
      );
    }
  });

  it("defines no UPDATE or DELETE policy on the audit trail", async () => {
    const { rows } = await admin.query<{ cmd: string }>(
      `select cmd from pg_policies
       where schemaname = 'public' and tablename = 'activity_events'`,
    );
    const commands = rows.map((r) => r.cmd).sort();
    expect(commands).toEqual(["INSERT", "SELECT"]);
  });

  it("rejects rewriting history even when the row is your own", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("update public.activity_events set summary = 'rewritten' where id = $1", [
          aliceActivityId,
        ]),
      );
      expect(denial.code).toBe("42501");
    });
  });

  it("rejects erasing history even when the row is your own", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("delete from public.activity_events where id = $1", [aliceActivityId]),
      );
      expect(denial.code).toBe("42501");
    });
  });

  it("constrains the actor to a known set", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `insert into public.activity_events (user_id, event_type, summary, actor)
           values ($1, 'test.actor', 'bad actor', 'impostor')`,
          [alice.id],
        ),
      );
      expect(denial.code).toBe("23514");
    });
  });
});
