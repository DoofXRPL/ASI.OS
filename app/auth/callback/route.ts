import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Where Supabase email links land: account confirmation and, once the owner
 * starts inviting people, invitation acceptance.
 *
 * It exchanges the one-time code for a session and then forwards to a path that
 * has been validated as same-origin. An auth callback that forwards to an
 * arbitrary destination is an open redirect on the most sensitive route in the
 * application.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  const failure = (message: string): NextResponse =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, origin),
    );

  if (!code) {
    return failure("That sign-in link was missing its code.");
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return failure("ASI OS is not configured.");
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return failure("That sign-in link has expired or was already used.");
  }

  return NextResponse.redirect(new URL(next, origin));
}
