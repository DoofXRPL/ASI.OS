import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, connect, createUser, expectDenied, type TestUser } from "./harness";

/**
 * Isolation and integrity for the two tables that hold work.
 *
 * Alongside the usual cross-account assertions, this suite proves the three
 * guarantees that are specific to migration 0002 and that the interface leans
 * on being true:
 *
 *   1. A capture cannot be rewritten, by anyone, including its author.
 *   2. A capture cannot be linked to another account's project — and trying is
 *      not a way to discover whether that project exists.
 *   3. A blocked project always says why, and only a blocked project carries a
 *      reason.
 *
 * Every denial is paired with a positive control. Without that pairing, a
 * policy that denied everyone would pass the entire suite.
 */

let admin: Client;
let alice: TestUser;
let bob: TestUser;

let aliceProjectId: string;
let bobProjectId: string;
let aliceCaptureId: string;

beforeAll(async () => {
  admin = await connect();

  alice = await createUser(admin, "work-alice@asi.test", "Alice");
  bob = await createUser(admin, "work-bob@asi.test", "Bob");

  aliceProjectId = await seedProject(alice, "Alice loft conversion");
  bobProjectId = await seedProject(bob, "Bob kitchen");
  aliceCaptureId = await seedCapture(alice, "alice private capture");
});

afterAll(async () => {
  await admin?.end();
});

async function seedProject(user: TestUser, name: string): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    "insert into public.projects (user_id, name) values ($1, $2) returning id",
    [user.id, name],
  );
  const row = rows[0];
  if (!row) throw new Error(`Failed to seed project for ${user.email}`);
  return row.id;
}

async function seedCapture(user: TestUser, content: string): Promise<string> {
  const { rows } = await admin.query<{ id: string }>(
    "insert into public.inbox_items (user_id, content) values ($1, $2) returning id",
    [user.id, content],
  );
  const row = rows[0];
  if (!row) throw new Error(`Failed to seed capture for ${user.email}`);
  return row.id;
}

describe("projects isolation", () => {
  it("lets a user read their own projects", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rows } = await query<{ name: string }>(
        "select name from public.projects",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe("Alice loft conversion");
    });
  });

  it("hides another user's project even when the row id is known", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const { rows } = await query("select id from public.projects where id = $1", [
        aliceProjectId,
      ]);
      expect(rows).toHaveLength(0);
    });
  });

  it("lets a user change their own project", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rowCount } = await query(
        "update public.projects set next_action = 'Call the surveyor' where id = $1",
        [aliceProjectId],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("silently affects no rows when changing another user's project", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const { rowCount } = await query(
        "update public.projects set name = 'Hijacked' where id = $1",
        [aliceProjectId],
      );
      expect(rowCount).toBe(0);
    });

    const { rows } = await admin.query<{ name: string }>(
      "select name from public.projects where id = $1",
      [aliceProjectId],
    );
    expect(rows[0]?.name).toBe("Alice loft conversion");
  });

  it("rejects creating a project owned by someone else", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("insert into public.projects (user_id, name) values ($1, 'Forged')", [
          alice.id,
        ]),
      );
      expect(denial.code).toBe("42501");
    });
  });

  it("gives no user the ability to delete a project", async () => {
    const { rows } = await admin.query<{ allowed: boolean }>(
      "select has_table_privilege('authenticated', 'public.projects', 'DELETE') as allowed",
    );
    expect(rows[0]?.allowed).toBe(false);
  });

  it("defines no DELETE policy on projects", async () => {
    const { rows } = await admin.query<{ cmd: string }>(
      `select cmd from pg_policies
       where schemaname = 'public' and tablename = 'projects'`,
    );
    expect(rows.map((r) => r.cmd).sort()).toEqual(["INSERT", "SELECT", "UPDATE"]);
  });
});

describe("a blocked project must say why", () => {
  it("refuses a blocker with no reason", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("update public.projects set status = 'blocked' where id = $1", [
          aliceProjectId,
        ]),
      );
      // 23514 = check_violation, from projects_blocked_reason_matches_status.
      expect(denial.code).toBe("23514");
    });
  });

  it("refuses a blocker whose reason is only whitespace", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `update public.projects set status = 'blocked', blocked_reason = '   '
           where id = $1`,
          [aliceProjectId],
        ),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("accepts a blocker that has a reason", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rowCount } = await query(
        `update public.projects
         set status = 'blocked', blocked_reason = 'Waiting on the surveyor'
         where id = $1`,
        [aliceProjectId],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("refuses to keep a reason on a project that is not blocked", async () => {
    // A solved blocker that survives unblocking would be displayed later as
    // though it still applied.
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `update public.projects
           set status = 'active', blocked_reason = 'Waiting on the surveyor'
           where id = $1`,
          [aliceProjectId],
        ),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("rejects a status outside the known set", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("update public.projects set status = 'on_fire' where id = $1", [
          aliceProjectId,
        ]),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("stores no next action as null rather than as an empty string", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("update public.projects set next_action = '' where id = $1", [
          aliceProjectId,
        ]),
      );
      expect(denial.code).toBe("23514");
    });
  });
});

describe("inbox isolation", () => {
  it("lets a user read their own captures", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rows } = await query<{ content: string }>(
        "select content from public.inbox_items",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.content).toBe("alice private capture");
    });
  });

  it("hides another user's captures even when the row id is known", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const { rows } = await query(
        "select id from public.inbox_items where id = $1",
        [aliceCaptureId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("lets a user capture something of their own", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rowCount } = await query(
        "insert into public.inbox_items (user_id, content) values ($1, 'a new thought')",
        [alice.id],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("rejects a capture attributed to another user", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          "insert into public.inbox_items (user_id, content) values ($1, 'forged')",
          [alice.id],
        ),
      );
      expect(denial.code).toBe("42501");
    });
  });

  it("affects no rows when processing another user's capture", async () => {
    await asUser(admin, bob, async ({ query }) => {
      const { rowCount } = await query(
        `update public.inbox_items
         set status = 'archived', processed_into = 'archived', processed_at = now()
         where id = $1`,
        [aliceCaptureId],
      );
      expect(rowCount).toBe(0);
    });
  });

  it("gives no user the ability to delete a capture", async () => {
    const { rows } = await admin.query<{ allowed: boolean }>(
      "select has_table_privilege('authenticated', 'public.inbox_items', 'DELETE') as allowed",
    );
    expect(rows[0]?.allowed).toBe(false);
  });
});

describe("captured text cannot be rewritten", () => {
  it("grants no UPDATE privilege on content, to anyone", async () => {
    const { rows } = await admin.query<{ allowed: boolean }>(
      `select has_column_privilege('authenticated', 'public.inbox_items', 'content', 'UPDATE')
       as allowed`,
    );
    expect(rows[0]?.allowed).toBe(false);
  });

  it("refuses an attempt to edit your own capture", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("update public.inbox_items set content = 'rewritten' where id = $1", [
          aliceCaptureId,
        ]),
      );
      expect(denial.code).toBe("42501");
    });

    const { rows } = await admin.query<{ content: string }>(
      "select content from public.inbox_items where id = $1",
      [aliceCaptureId],
    );
    expect(rows[0]?.content).toBe("alice private capture");
  });

  it("still allows the classification and status around it to change", async () => {
    // The positive control for the rule above: everything except the words
    // themselves remains editable.
    await asUser(admin, alice, async ({ query }) => {
      const { rowCount } = await query(
        `update public.inbox_items
         set kind = 'question', status = 'processed',
             processed_into = 'project_material', processed_at = now(),
             project_id = $2
         where id = $1`,
        [aliceCaptureId, aliceProjectId],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("grants no UPDATE privilege on source, so an origin cannot be claimed", async () => {
    const { rows } = await admin.query<{ allowed: boolean }>(
      `select has_column_privilege('authenticated', 'public.inbox_items', 'source', 'UPDATE')
       as allowed`,
    );
    expect(rows[0]?.allowed).toBe(false);
  });
});

describe("a capture can only reference your own project", () => {
  it("refuses to link a capture to another account's project", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `insert into public.inbox_items (user_id, content, project_id)
           values ($1, 'cross-account link', $2)`,
          [alice.id, bobProjectId],
        ),
      );
      // 23503 = foreign_key_violation, from the composite (user_id, project_id)
      // reference. A plain project_id key would have accepted this row.
      expect(denial.code).toBe("23503");
    });
  });

  it("refuses the same link on update", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("update public.inbox_items set project_id = $2 where id = $1", [
          aliceCaptureId,
          bobProjectId,
        ]),
      );
      expect(denial.code).toBe("23503");
    });
  });

  it("gives the same answer for a project id that does not exist at all", async () => {
    // Identical failure for "someone else's" and "nobody's", so the constraint
    // cannot be used to test whether an identifier exists.
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `insert into public.inbox_items (user_id, content, project_id)
           values ($1, 'link to nothing', '00000000-0000-4000-8000-00000000dead')`,
          [alice.id],
        ),
      );
      expect(denial.code).toBe("23503");
    });
  });

  it("accepts a link to a project you own", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rowCount } = await query(
        `insert into public.inbox_items (user_id, content, project_id)
         values ($1, 'own-project link', $2)`,
        [alice.id, aliceProjectId],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("accepts a capture with no project at all", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rowCount } = await query(
        "insert into public.inbox_items (user_id, content) values ($1, 'unlinked')",
        [alice.id],
      );
      expect(rowCount).toBe(1);
    });
  });
});

describe("processed can never mean nothing", () => {
  it("refuses a processed capture with no time and no route", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("update public.inbox_items set status = 'processed' where id = $1", [
          aliceCaptureId,
        ]),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("refuses a route with no time", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `update public.inbox_items
           set status = 'archived', processed_into = 'archived'
           where id = $1`,
          [aliceCaptureId],
        ),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("refuses a capture that claims to still be waiting after being processed", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `update public.inbox_items
           set status = 'unprocessed', processed_into = 'archived', processed_at = now()
           where id = $1`,
          [aliceCaptureId],
        ),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("refuses a project route with no project", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `update public.inbox_items
           set status = 'processed', processed_into = 'project_next_action',
               processed_at = now(), project_id = null
           where id = $1`,
          [aliceCaptureId],
        ),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("accepts archiving, which needs no project", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const { rowCount } = await query(
        `update public.inbox_items
         set status = 'archived', processed_into = 'archived', processed_at = now()
         where id = $1`,
        [aliceCaptureId],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("rejects a route the interface does not define", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query(
          `update public.inbox_items
           set status = 'processed', processed_into = 'deleted', processed_at = now()
           where id = $1`,
          [aliceCaptureId],
        ),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("rejects a kind outside the known set", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("update public.inbox_items set kind = 'reminder' where id = $1", [
          aliceCaptureId,
        ]),
      );
      expect(denial.code).toBe("23514");
    });
  });

  it("accepts no kind at all, because unclassified is a real state", async () => {
    // A separate transaction from the denial above: a rejected statement aborts
    // the one it was issued in, so a positive control has to stand on its own.
    await asUser(admin, alice, async ({ query }) => {
      const { rowCount } = await query(
        "update public.inbox_items set kind = null where id = $1",
        [aliceCaptureId],
      );
      expect(rowCount).toBe(1);
    });
  });

  it("refuses an empty capture", async () => {
    await asUser(admin, alice, async ({ query }) => {
      const denial = await expectDenied(() =>
        query("insert into public.inbox_items (user_id, content) values ($1, '  ')", [
          alice.id,
        ]),
      );
      expect(denial.code).toBe("23514");
    });
  });
});
