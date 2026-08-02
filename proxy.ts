import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createBurstLimiter } from "@/lib/early-access/burst";
import { clientBucket, clientIpFromHeaders } from "@/lib/early-access/client-id";
import { INTAKE_BURST, INTAKE_MAX_BODY_BYTES } from "@/lib/early-access/limits";
import { intakeEvent, logIntake, type IntakeOutcome } from "@/lib/early-access/log";
import { redirectPreservingSession, updateSession } from "@/lib/supabase/proxy-session";

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

/**
 * The one route an unauthenticated visitor can write through, and therefore the
 * one route worth guarding here.
 *
 * Two refusals happen at the edge, before the session is refreshed and before
 * any application code runs, because both are decidable from the request line
 * alone and neither is worth a database round trip:
 *
 *   * a body larger than this form can produce, and
 *   * a burst faster than a person can submit.
 *
 * Neither replaces what the database does. The bucket lives in one instance's
 * memory, so a distributed flood spreads across several and each sees a fraction
 * of it; the count that holds is in `access.intake_counters`. This is the cheap
 * layer, in the cheapest place, and it is honest about being the weaker one.
 *
 * Volumetric attacks are not answered here at all. Absorbing those is what the
 * platform's own firewall is for — see docs/SECURITY.md.
 */
const INTAKE_PATH = "/early-access";

const intakeBurst = createBurstLimiter(INTAKE_BURST);

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const refusal = guardIntake(request);
  if (refusal) return refusal;

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

function guardIntake(request: NextRequest): NextResponse | null {
  if (request.method !== "POST") return null;
  if (request.nextUrl.pathname !== INTAKE_PATH) return null;

  // `content-length` is the client's own claim, which is enough here: a body
  // that lies about its size is refused by the Server Action body limit in
  // next.config.ts instead. What this stops is the honest large body, which is
  // the one that would otherwise be read into memory first and rejected second.
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > INTAKE_MAX_BODY_BYTES) {
    return refuse(413, "oversize");
  }

  // The address is the bucket key and never leaves this function: it is not
  // logged, not hashed into anything durable, and not kept beyond the time the
  // bucket takes to refill.
  const decision = intakeBurst.take(bucketKey(request), Date.now());
  if (!decision.allowed) {
    return refuse(429, "burst", Math.ceil(decision.retryAfterMs / 1000));
  }

  return null;
}

/**
 * Which bucket a request draws from at the edge.
 *
 * The same network the database meters, for the same reason: keying on the exact
 * address gave every address in an IPv6 /64 its own bucket, so rotating inside
 * one — which costs an attacker nothing — refilled this limiter as reliably as it
 * emptied the one in PostgreSQL. `clientBucket` is the single definition of what
 * counts as one caller.
 */
function bucketKey(request: NextRequest): string {
  return clientBucket(clientIpFromHeaders(request.headers)) ?? "unattributed";
}

/**
 * A refusal that says what happened and nothing about how it was decided.
 *
 * It answers with a page rather than a bare status because the form works
 * without JavaScript, and there a refusal *is* the next page — an empty body
 * would leave the visitor looking at a blank window. The markup is deliberately
 * self-contained: reaching for the application's own layout would mean rendering
 * React to tell someone to wait a minute.
 */
function refuse(
  status: 413 | 429,
  outcome: IntakeOutcome,
  retryAfterSeconds?: number,
): NextResponse {
  logIntake(intakeEvent({ correlationId: crypto.randomUUID(), outcome }));

  const message =
    status === 429
      ? "Too many requests have arrived from this connection. Nothing was saved."
      : "That request was larger than this form accepts. Nothing was saved.";

  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex",
  });
  if (retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(Math.max(1, retryAfterSeconds)));
  }

  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Request not accepted — ASI.OS</title></head>` +
      `<body style="margin:0;min-height:100vh;display:grid;place-items:center;` +
      `font:16px/1.6 system-ui,sans-serif;background:#fbfbfa;color:#1c1c1a">` +
      `<main style="max-width:32rem;padding:2rem"><h1 style="font-size:1.25rem;margin:0 0 .75rem">` +
      `Request not accepted</h1><p style="margin:0 0 1.5rem">${message}</p>` +
      `<a href="${INTAKE_PATH}" style="color:#1c1c1a">Back to the request form</a>` +
      `</main></body></html>`,
    { status, headers },
  );
}

export const config = {
  matcher: [
    /*
     * The front page is public and protects nothing, but it does ask whether the
     * visitor is signed in so it can offer the way back in. Server Components
     * cannot write refreshed session cookies, so without this entry a valid
     * session with an expired access token would read as signed out here.
     */
    "/",
    /*
     * Public, and it writes: the early-access form posts a Server Action back
     * to this route. It is listed for the same reason as `/` — the header asks
     * whether the visitor is signed in, and without a refreshed session cookie
     * a valid session with an expired access token would read as signed out.
     */
    "/early-access",
    "/today/:path*",
    "/inbox/:path*",
    "/projects/:path*",
    "/activity/:path*",
    "/settings/:path*",
    "/login",
  ],
};
