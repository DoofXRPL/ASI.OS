import { resetDatabase, resolveDatabaseUrl } from "./harness";

/**
 * Rebuilds the test database once before the RLS project runs, so every suite
 * starts from migrations applied to an empty database. This also means a broken
 * migration fails CI here rather than in production.
 */
export default async function setup(): Promise<void> {
  const url = resolveDatabaseUrl();
  await resetDatabase(url);
  console.log(`[rls] migrations applied to ${new URL(url).pathname.slice(1)}`);
}
