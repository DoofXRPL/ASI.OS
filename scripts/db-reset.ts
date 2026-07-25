/**
 * Rebuilds the local test database from migrations.
 *
 *   TEST_DATABASE_URL=postgresql://... npm run db:reset
 *
 * Intended for the RLS suite and local experiments. It drops the `public` and
 * `auth` schemas, so it refuses to run against a database whose name does not
 * contain "test".
 */
import { resetDatabase, resolveDatabaseUrl } from "../tests/rls/harness";

async function main(): Promise<void> {
  if (process.argv.includes("--help")) {
    console.log(
      [
        "Usage: TEST_DATABASE_URL=<url> npm run db:reset",
        "",
        "Drops the public and auth schemas, applies tests/rls/auth-shim.sql,",
        "then applies every migration in supabase/migrations in order.",
        "",
        "The database name must contain \"test\".",
      ].join("\n"),
    );
    return;
  }

  const url = resolveDatabaseUrl();
  await resetDatabase(url);
  console.log(`Rebuilt ${new URL(url).pathname.slice(1)} from supabase/migrations.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
