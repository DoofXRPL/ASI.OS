import type { NextRequest, NextResponse } from "next/server";
import { safeRedirectPath } from "@/lib/auth/redirect";
import {
  redirectPreservingSession,
  updateSession,
} from "@/lib/supabase/proxy-session";

/**
 * Route protection. (In Next.js 16 this file replaces `middleware.ts`.)
 *
 * It fails closed. When Supabase is not configured, `updateSession` reports no
 * user, so every private route redirects to sign-in — an unconfigured deployment
 * exposes nothing rather than defaulting open. The sign-in page then explains
 * what is missing instead of showing a form that cannot work.
 *
 * This is a convenience and a session-refresh boundary, not the security model.
 * Each page independently resolves identity through `requireAuthedSession()`, and
 * PostgreSQL independently enforces ownership through Row Level Security.
 */
const PRIVATE_PREFIXES = [
  "/today",
  "/inbox",
  "/projects",
  "/activity",
  "/settings",
] as const;

function isPrivate(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { response, user, configured } = await updateSession(request);
  const { pathname, searchParams } = request.nextUrl;

  if (isPrivate(pathname) && !user) {
    const url = new URL("/login", request.url);
    // Only offer to return the visitor somewhere if signing in can succeed.
    if (configured) url.searchParams.set("redirect", pathname);
    return redirectPreservingSession(url, response);
  }

  if (pathname === "/login" && user) {
    const target = safeRedirectPath(searchParams.get("redirect"));
    return redirectPreservingSession(new URL(target, request.url), response);
  }

  return response;
}

export const config = {
  matcher: [
    "/today/:path*",
    "/inbox/:path*",
    "/projects/:path*",
    "/activity/:path*",
    "/settings/:path*",
    "/login",
  ],
};
