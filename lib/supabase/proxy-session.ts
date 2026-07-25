import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

export interface ProxySessionResult {
  /** The response carrying any refreshed session cookies. */
  response: NextResponse;
  user: { id: string; email: string | null } | null;
  /** False when Supabase is not configured, which must make private routes unreachable. */
  configured: boolean;
}

/**
 * Refreshes the Supabase session on every request and reports who the caller is.
 *
 * `getUser()` is used rather than `getSession()` deliberately: it validates the
 * token against Supabase Auth instead of trusting a cookie that a client
 * controls. This is the one call that must happen before any routing decision.
 */
export async function updateSession(
  request: NextRequest,
): Promise<ProxySessionResult> {
  let response = NextResponse.next({ request });

  const env = getSupabaseEnv();
  if (!env) {
    return { response, user: null, configured: false };
  }

  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { response, user: null, configured: true };
  }

  return {
    response,
    user: { id: data.user.id, email: data.user.email ?? null },
    configured: true,
  };
}

/**
 * Redirects while preserving refreshed session cookies.
 *
 * Without this, a redirect issued in the same request that rotated a refresh
 * token throws the new token away and signs the user out at random.
 */
export function redirectPreservingSession(
  url: URL,
  carrying: NextResponse,
): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of carrying.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  return redirect;
}
