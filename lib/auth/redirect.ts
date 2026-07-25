/**
 * Where an unauthenticated visitor lands after signing in.
 * Today is the home of the loop, so it is the default destination.
 */
export const DEFAULT_SIGNED_IN_PATH = "/today";

/**
 * Sanitises a caller-supplied `redirect` parameter.
 *
 * A sign-in flow that forwards to an arbitrary destination is a phishing
 * primitive: an attacker sends `/login?redirect=https://evil.example`, the user
 * authenticates on a page they trust, and is handed to a site that looks
 * identical. Only same-origin absolute paths are accepted; anything else falls
 * back to a known-safe route.
 */
export function safeRedirectPath(
  candidate: string | null | undefined,
  fallback: string = DEFAULT_SIGNED_IN_PATH,
): string {
  if (typeof candidate !== "string") return fallback;

  const value = candidate.trim();

  if (
    value.length === 0 ||
    // Must be an absolute path on this origin.
    !value.startsWith("/") ||
    // Protocol-relative URLs (`//evil.example`) resolve off-origin.
    value.startsWith("//") ||
    // Backslashes are normalised to slashes by some agents, so `/\evil` escapes.
    value.includes("\\") ||
    // Control characters enable header and parser confusion.
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const sentinel = "https://asi-os.invalid";
    const parsed = new URL(value, sentinel);
    if (parsed.origin !== sentinel) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
