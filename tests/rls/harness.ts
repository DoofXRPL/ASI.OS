import { createHash, randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Client, type QueryResult, type QueryResultRow } from "pg";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");
const AUTH_SHIM = path.join(REPO_ROOT, "tests", "rls", "auth-shim.sql");

/**
 * Refuses to touch a database whose name does not look disposable. `resetDatabase`
 * drops schemas, so pointing it at the wrong URL must be impossible rather than
 * merely unlikely.
 */
export function resolveDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. The RLS suite requires a disposable PostgreSQL database.\n" +
        "See tests/rls/README.md for setup, or run: npm run db:reset -- --help",
    );
  }

  const databaseName = safeDatabaseName(url);
  if (!/test/i.test(databaseName)) {
    throw new Error(
      `Refusing to run against database "${databaseName}": its name must contain "test".\n` +
        "This suite drops and recreates schemas.",
    );
  }

  return url;
}

function safeDatabaseName(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\//, "");
  } catch {
    throw new Error("TEST_DATABASE_URL is not a valid connection URL.");
  }
}

export async function connect(url = resolveDatabaseUrl()): Promise<Client> {
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

/**
 * Drops and rebuilds the schema, then applies the auth shim followed by every
 * migration in lexical order. Migrations are applied exactly as a real Supabase
 * project would apply them, so a migration that only works against a
 * pre-existing database will fail here — which is the point.
 */
export async function resetDatabase(url = resolveDatabaseUrl()): Promise<void> {
  const client = await connect(url);
  try {
    // `access` is dropped here as well as `public` and `auth`. A migration
    // that creates a schema this list does not know about would survive a
    // reset and let one run's rows leak into the next, so a new schema means
    // a new line here — see supabase/migrations/0003_early_access.sql.
    await client.query(`
      drop schema if exists public cascade;
      drop schema if exists auth cascade;
      drop schema if exists access cascade;
      create schema public;
    `);

    await client.query(await readFile(AUTH_SHIM, "utf8"));

    for (const file of await migrationFiles()) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query(sql);
      } catch (cause) {
        throw new Error(
          `Migration ${file} failed: ${(cause as Error).message}`,
          { cause },
        );
      }
    }
  } finally {
    await client.end();
  }
}

export async function migrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((name) => name.endsWith(".sql")).sort();
}

/**
 * Teaches the database to recognise a caller of `public.request_early_access()`.
 *
 * The digest is computed here, in Node, rather than by the database — which is
 * the point. If `createHash("sha256")` and PostgreSQL's `sha256(convert_to(...))`
 * ever disagreed about the same key, the front door would refuse the only caller
 * allowed through it, and every test that calls the function would notice.
 *
 * Committed rather than rolled back: each suite registers its own key once and
 * the tests inside it run in transactions that are discarded.
 */
export async function registerIntakeKey(
  client: Client,
  key: string,
  label: string,
): Promise<void> {
  await client.query(
    `insert into access.intake_keys (label, key_sha256)
     values ($1, decode($2, 'hex'))
     on conflict (key_sha256) do nothing`,
    [label, createHash("sha256").update(key, "utf8").digest("hex")],
  );
}

/**
 * A caller identifier of the shape `access.intake_counters.bucket` accepts:
 * 32 hexadecimal characters, which is what `hashClientId` produces in the
 * application. Random, so one test's meter is never another's.
 */
export function testClientHash(): string {
  return randomBytes(16).toString("hex");
}

/**
 * The most connections any one test may hold at once.
 *
 * This suite runs against plain PostgreSQL 14+ — that is the promise in
 * tests/rls/README.md and AGENTS.md, and CI keeps it by using a stock
 * `postgres:16` container. A stock server allows 100 connections in total, so a
 * test that wants a hundred of them cannot run in the environment the suite
 * claims to need, and the first version of this file asked for exactly that.
 *
 * 32 is chosen against measurement rather than taste. Against the check-then-act
 * meter this suite exists to catch, with `per_client_max` 5 and 20 runs at each
 * width: 4 connections never caught the race, 6 caught it 19 times out of 20, and
 * 8 caught it every time. 32 is four times the width that is already reliable and
 * about a third of the smallest budget the suite supports, which leaves room for
 * the admin connection every file holds and for whatever else shares the server.
 *
 * Fixed rather than derived from the server's own limit, so a run that passes here
 * means the same thing as a run that passes in CI.
 */
export const MAX_PARALLEL_CALLERS = 32;

/** Read once: it cannot change under a running server. */
let connectionBudget: Promise<number> | null = null;

/**
 * How many connections this server will actually give us.
 *
 * Without this, asking for more than the server has produces a cascade rather
 * than a diagnosis: `Promise.all` rejects with `53300`, and every later test in
 * the file fails too because the connections that *did* open are still held. The
 * message names the setting to change, since that is the only useful thing to say.
 */
async function assertBudgetFor(count: number, url: string): Promise<void> {
  connectionBudget ??= (async () => {
    const client = await connect(url);
    try {
      const { rows } = await client.query<{ name: string; setting: string }>(
        `select name, setting from pg_settings
          where name in ('max_connections', 'superuser_reserved_connections')`,
      );
      const setting = (name: string) =>
        Number(rows.find((row) => row.name === name)?.setting ?? 0);
      return setting("max_connections") - setting("superuser_reserved_connections");
    } finally {
      await client.end();
    }
  })();

  // One spare for the admin connection each suite holds, and one for this check.
  const needed = count + 2;
  const available = await connectionBudget;
  if (needed > available) {
    throw new Error(
      `This test needs ${count} concurrent connections and the server offers ${available}.\n` +
        `Raise max_connections to at least ${needed + 8} and restart it, ` +
        `or see tests/rls/README.md.`,
    );
  }
}

/**
 * Several independent `anon` connections, each committing its own work.
 *
 * `asAnon` runs everything on one connection inside a transaction that is rolled
 * back, which is right for testing what a role may touch and blind to anything
 * decided *between* transactions. A limit that is read and then acted on looks
 * correct from a single connection and holds nothing at all from thirty — so
 * proving a limit holds needs real backends, committing for real.
 *
 * The caller is responsible for cleaning up, since nothing here is rolled back.
 */
export async function withParallelAnon<T>(
  count: number,
  work: (clients: Client[]) => Promise<T>,
  url = resolveDatabaseUrl(),
): Promise<T> {
  if (count > MAX_PARALLEL_CALLERS) {
    throw new Error(
      `${count} concurrent callers exceeds MAX_PARALLEL_CALLERS (${MAX_PARALLEL_CALLERS}). ` +
        "The constant is what keeps this suite runnable on a stock PostgreSQL server; " +
        "read the note beside it before raising it.",
    );
  }
  await assertBudgetFor(count, url);

  const clients: Client[] = [];
  try {
    // Collected as they open, so a failure part-way through still closes the ones
    // that did. Opening them inside `Promise.all` and assigning afterwards leaks
    // every connection when any single one is refused, which is how one
    // over-budget test used to take the rest of the file down with it.
    await Promise.all(
      Array.from({ length: count }, async () => {
        const client = await connect(url);
        clients.push(client);
        // Downgraded for the life of the connection, not for a transaction, so
        // the statement under test runs in its own implicit transaction —
        // exactly as PostgREST runs one RPC call.
        await client.query("set role anon");
      }),
    );

    return await work(clients);
  } finally {
    await Promise.all(clients.map((client) => client.end().catch(() => undefined)));
  }
}

/**
 * Runs the same statement on every connection at once and returns what each
 * said, with a failure reported as its SQLSTATE rather than thrown — a test
 * about a limit wants to see all the answers, not the first exception.
 */
export async function inParallel(
  clients: Client[],
  sql: string,
  params: (index: number) => unknown[],
): Promise<string[]> {
  // Warmed first, so the parse and bind round trips are not what staggers them.
  await Promise.all(clients.map((client) => client.query("select 1")));

  return Promise.all(
    clients.map((client, index) =>
      client.query<{ result: string }>(sql, params(index)).then(
        (result) => String(result.rows[0]?.result),
        (error: { code?: string }) => `error:${error.code ?? "unknown"}`,
      ),
    ),
  );
}

export interface TestUser {
  id: string;
  email: string;
}

/**
 * Creates a real row in `auth.users`, which fires the provisioning trigger just
 * as a genuine signup would. Nothing here is mocked.
 */
export async function createUser(
  client: Client,
  email: string,
  displayName?: string,
): Promise<TestUser> {
  const meta = displayName ? JSON.stringify({ display_name: displayName }) : "{}";
  const result = await client.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, $2::jsonb)
     returning id`,
    [email, meta],
  );
  const row = result.rows[0];
  if (!row) throw new Error(`Failed to create test user ${email}`);
  return { id: row.id, email };
}

/**
 * Runs `work` with the connection downgraded to the `authenticated` role and the
 * JWT claims of `user`, which is precisely the context Supabase's PostgREST
 * layer establishes for a signed-in request. Everything happens inside a
 * transaction that is always rolled back, so assertions never leak state.
 */
export async function asUser<T>(
  client: Client,
  user: TestUser,
  work: (ctx: AuthenticatedContext) => Promise<T>,
): Promise<T> {
  return inRole(client, "authenticated", work, {
    sub: user.id,
    role: "authenticated",
    email: user.email,
  });
}

/**
 * Runs `work` as `anon` — the role Supabase uses for a request carrying no
 * session, which is every visitor to a public page. No JWT claims are set, so
 * `auth.uid()` is null, exactly as it is in production.
 *
 * Rolled back like `asUser`, so a suite can watch a row land and still leave
 * the database as it found it.
 */
export async function asAnon<T>(
  client: Client,
  work: (ctx: RoleContext) => Promise<T>,
): Promise<T> {
  return inRole(client, "anon", work, null);
}

export interface RoleContext {
  /** Runs as the downgraded role, which is what is under test. */
  query: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
  /**
   * Runs as the harness's own connection, still inside the transaction that
   * will be rolled back.
   *
   * Needed to check what a write actually stored: the role under test usually
   * cannot read the row it just created — for the early-access queue, that is
   * the whole point — and reading it on a second connection would not see an
   * uncommitted row at all.
   */
  inspect: <T extends QueryResultRow = QueryResultRow>(
    sql: string,
    params?: unknown[],
  ) => Promise<QueryResult<T>>;
}

export interface AuthenticatedContext extends RoleContext {
  userId: string;
}

async function inRole<T>(
  client: Client,
  role: "anon" | "authenticated",
  work: (ctx: AuthenticatedContext) => Promise<T>,
  claims: Record<string, unknown> | null,
): Promise<T> {
  const enter = async () => {
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      claims ? JSON.stringify(claims) : "",
    ]);
    await client.query(`set local role ${role}`);
  };

  await client.query("begin");
  try {
    await enter();
    return await work({
      query: (sql, params) => client.query(sql, params),
      inspect: async (sql, params) => {
        await client.query("reset role");
        try {
          return await client.query(sql, params);
        } finally {
          await enter();
        }
      },
      userId: typeof claims?.sub === "string" ? claims.sub : "",
    });
  } finally {
    await client.query("rollback");
  }
}

/**
 * Asserts that a statement is rejected by the database. Returns the SQLSTATE so
 * a test can require a *specific* denial (for example `42501`, insufficient
 * privilege) rather than accepting any error at all.
 */
export async function expectDenied(
  run: () => Promise<unknown>,
): Promise<{ code: string; message: string }> {
  try {
    await run();
  } catch (error) {
    const err = error as { code?: string; message?: string };
    return { code: err.code ?? "unknown", message: err.message ?? "" };
  }
  throw new Error("Expected the database to reject this statement, but it succeeded.");
}
