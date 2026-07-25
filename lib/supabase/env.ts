/**
 * Supabase environment resolution.
 *
 * This module never throws on import and never guesses. If configuration is
 * absent it says so, and every caller is expected to fail closed: the proxy
 * makes private routes unreachable, and the sign-in page explains exactly what
 * is missing instead of rendering a form that cannot work.
 *
 * Only public values are read here. The service role key is deliberately absent
 * from the entire application: it bypasses Row Level Security, which is the one
 * boundary this product relies on. `scripts/guard-service-role.ts` enforces that.
 */

export interface SupabaseEnv {
  url: string;
  /**
   * The publishable (formerly "anon") key. Requests made with it are subject to
   * Row Level Security, which is precisely why it is the only key we use.
   */
  publishableKey: string;
}

export type SupabaseEnvStatus =
  | { configured: true; env: SupabaseEnv }
  | { configured: false; missing: string[] };

const URL_VAR = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_VARS = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/** Resolves configuration, or reports precisely which variables are missing. */
export function getSupabaseEnvStatus(): SupabaseEnvStatus {
  const url = read(URL_VAR);
  const key = KEY_VARS.map(read).find(Boolean);

  const missing: string[] = [];
  if (!url) missing.push(URL_VAR);
  if (!key) missing.push(`${KEY_VARS[0]} (or ${KEY_VARS[1]})`);

  if (!url || !key) return { configured: false, missing };
  return { configured: true, env: { url, publishableKey: key } };
}

/** Returns configuration, or null when Supabase is not configured. */
export function getSupabaseEnv(): SupabaseEnv | null {
  const status = getSupabaseEnvStatus();
  return status.configured ? status.env : null;
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnvStatus().configured;
}
