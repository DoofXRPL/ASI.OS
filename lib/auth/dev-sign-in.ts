/**
 * Skipping the sign-in screen during development.
 *
 * Authentication cannot simply be turned off here and leave a working product.
 * Row Level Security is the only isolation boundary, and it answers questions
 * as *somebody*: with no caller, `auth.uid()` is null, every policy matches
 * nothing, and the interface truthfully reports that you own no records. An app
 * with authentication removed is not an open app, it is an empty one.
 *
 * So this does the only thing that removes the login screen and leaves the
 * product intact: it signs in for real, automatically, with credentials you
 * supply. Nothing downstream changes. The session is a genuine Supabase
 * session, the cookies are the ones the form would have set, every query still
 * runs as that user, and RLS is still the boundary.
 *
 * Two guards keep it where it belongs:
 *
 *   1. It is inert unless BOTH `ASI_DEV_SIGN_IN_EMAIL` and
 *      `ASI_DEV_SIGN_IN_PASSWORD` are set, so it can never switch itself on.
 *   2. It refuses to resolve in a production build, whatever else is set. A
 *      convenience that can reach production is not a convenience.
 *
 * It is also visible: `AccountPanel` says the session was created
 * automatically. An interface that signs you in without mentioning it is the
 * kind of quiet dishonesty this product exists to avoid, and the marker is the
 * fastest way to notice the shortcut is still on when you meant to be testing
 * the real thing.
 */

export interface DevSignIn {
  email: string;
  password: string;
}

export interface DevSignInEnv {
  email: string | undefined;
  password: string | undefined;
  nodeEnv: string | undefined;
}

/**
 * Resolves development sign-in credentials, or null when the shortcut is off.
 *
 * Pure, and deliberately separate from the proxy, so the exact conditions under
 * which the sign-in screen can be skipped are testable exhaustively — without a
 * browser, a database, or a running server.
 */
export function resolveDevSignIn(env: DevSignInEnv): DevSignIn | null {
  // Checked first, so no combination of the other variables can matter in
  // production.
  if (env.nodeEnv === "production") return null;

  const email = env.email?.trim();
  // Not trimmed: leading or trailing whitespace in a password is part of the
  // password, and silently removing it would produce a failure with no
  // explanation.
  const password = env.password;

  if (!email || !password) return null;

  return { email, password };
}

/** Reads the shortcut from the ambient environment. */
export function getDevSignIn(): DevSignIn | null {
  return resolveDevSignIn({
    email: process.env.ASI_DEV_SIGN_IN_EMAIL,
    password: process.env.ASI_DEV_SIGN_IN_PASSWORD,
    nodeEnv: process.env.NODE_ENV,
  });
}
