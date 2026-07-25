import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

export type AsiSupabaseClient = SupabaseClient<Database>;

/**
 * The server-side Supabase client, authenticated as the signed-in visitor via
 * their session cookie.
 *
 * Every database read and write in ASI OS goes through a client like this one,
 * so PostgreSQL evaluates Row Level Security against the real caller. There is
 * no privileged path: no service role client exists in this application.
 *
 * Returns null when Supabase is not configured, so callers fail closed.
 */
export async function createSupabaseServerClient(): Promise<AsiSupabaseClient | null> {
  const env = getSupabaseEnv();
  if (!env) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. That is expected: the proxy
          // refreshes the session on every request, so nothing is lost here.
        }
      },
    },
  });
}
