/**
 * The one place in the application that names `ASI_INTAKE_KEY`.
 *
 * The key proves to `public.request_early_access()` that a call came from this
 * deployment rather than from anyone who read the publishable key out of the
 * page source. The database stores only its SHA-256, so this value exists in
 * exactly two places: the deployment's environment, and a row in
 * `access.intake_keys` that cannot be turned back into it.
 *
 * It is not a privileged credential and must never become one. It buys the right
 * to call one insert-only function; it reads nothing, and Row Level Security is
 * untouched by it. `npm run guard:service-role` confines the variable name to
 * this file and fails the build on any `NEXT_PUBLIC_` spelling of it, because a
 * key that reaches the browser is a key everybody has.
 *
 * Absent, this returns null and nothing is recorded — the page says so. Failing
 * closed is the only safe direction: the alternative is a deployment that
 * accepts submissions through an unguarded door because a variable was
 * forgotten.
 */

/**
 * Short enough to accept a sensibly generated key, long enough that a
 * placeholder someone typed by hand is not one. `npm run intake:key` produces 64
 * hexadecimal characters.
 */
export const INTAKE_KEY_MIN_LENGTH = 32;

export function getIntakeKey(): string | null {
  const raw = process.env.ASI_INTAKE_KEY?.trim();
  if (!raw || raw.length < INTAKE_KEY_MIN_LENGTH) return null;
  return raw;
}
