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
