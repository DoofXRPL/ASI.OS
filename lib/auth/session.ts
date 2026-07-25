import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/supabase/database.types";

export interface AuthedUser {
  id: string;
  email: string | null;
}

export interface AuthedSession {
  user: AuthedUser;
  profile: ProfileRow;
}

/**
 * The single source of server-side identity.
 *
 * Identity is always resolved from the validated session, never from a client
 * supplied user id. Nothing else in the codebase should call `auth.getUser()`.
 *
 * Note that no access token is returned. The server client is already
 * authenticated as this user, so a token never needs to travel through
 * application code — which means it cannot be logged, forwarded, or leaked by
 * accident.
 */
export async function getAuthedUser(): Promise<AuthedUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}

/**
 * Loads the caller and their profile, or null if either is unavailable.
 *
 * A missing profile is treated as "not signed in" rather than being papered
 * over: the signup trigger provisions it, so its absence means something is
 * genuinely wrong and should be visible instead of silently patched.
 */
export async function getAuthedSession(): Promise<AuthedSession | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!profile) return null;

  return {
    user: { id: data.user.id, email: data.user.email ?? null },
    profile,
  };
}

/** Guards a private page. Redirects to sign-in, preserving where you were going. */
export async function requireAuthedSession(
  returnTo?: string,
): Promise<AuthedSession> {
  const session = await getAuthedSession();
  if (session) return session;

  const target = returnTo
    ? `/login?redirect=${encodeURIComponent(returnTo)}`
    : "/login";
  redirect(target);
}

/**
 * Decides whether an account is the owner.
 *
 * Two independent signals must agree: the database must have marked this account
 * as the owner, and — when `ASI_OWNER_EMAIL` is configured — the signed-in email
 * must match it. Either check failing denies ownership, so a database compromise
 * alone does not confer owner powers, and a misconfigured environment variable
 * cannot invent them.
 *
 * Kept pure and separate from the session so it can be tested exhaustively.
 */
export function checkOwner(input: {
  isOwnerInDatabase: boolean;
  email: string | null;
  expectedOwnerEmail: string | null | undefined;
}): boolean {
  if (!input.isOwnerInDatabase) return false;

  const expected = input.expectedOwnerEmail?.trim().toLowerCase();
  if (!expected) return true;

  const actual = input.email?.trim().toLowerCase();
  return actual !== undefined && actual === expected;
}

export function isOwner(session: AuthedSession): boolean {
  return checkOwner({
    isOwnerInDatabase: session.profile.is_owner,
    email: session.user.email,
    expectedOwnerEmail: process.env.ASI_OWNER_EMAIL,
  });
}

/**
 * A greeting that never invents a name. When no display name has been set, the
 * greeting stays generic rather than guessing from an email address.
 */
export function greetingFor(profile: ProfileRow, now: Date = new Date()): string {
  const hour = now.getHours();
  const partOfDay =
    hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const name = profile.display_name?.trim();
  return name ? `${partOfDay}, ${name}` : partOfDay;
}
