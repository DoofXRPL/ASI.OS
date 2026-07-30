import { createHmac } from "node:crypto";

/**
 * Who is asking, expressed as something the database is willing to remember.
 *
 * The meter in `public.request_early_access()` needs to count requests per
 * caller, and the obvious way to do that is to store the caller's address. This
 * product will not: an intake queue is a list of strangers, and a list of
 * strangers with their addresses beside them is a different and worse thing than
 * a list of people who asked for access.
 *
 * So the address is turned into a keyed digest before it leaves the server, and
 * three properties make that more than a gesture:
 *
 *   * It is keyed, not merely hashed. IPv4 has four billion values, which a
 *     plain SHA-256 of every one of them enumerates in seconds; an HMAC under a
 *     secret the database does not hold cannot be reversed that way by anyone
 *     reading the table.
 *   * The current UTC date is part of the input, so the same visitor is a
 *     different digest tomorrow. Rows that outlive a day cannot be joined
 *     against rows that follow them.
 *   * The result is truncated to 32 hexadecimal characters, which is the shape
 *     `access.intake_attempts.client_hash` constrains itself to. An address
 *     cannot be written to that column even by a caller trying to.
 */

/** Matches the check constraint on `access.intake_attempts.client_hash`. */
export const CLIENT_ID_LENGTH = 32;

/** Everything hashed here is separated from any other use of the same key. */
const DOMAIN = "asi.intake.client";

/**
 * What stands in for an address when there is none — a local request, or a
 * platform that did not forward one. Everyone in that position shares a bucket,
 * which is the safe direction to be wrong in.
 */
const NO_ADDRESS = "unattributed";

export function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function hashClientId(input: {
  ip: string | null;
  dayKey: string;
  pepper: string;
}): string {
  return createHmac("sha256", input.pepper)
    .update(`${DOMAIN}\n${input.dayKey}\n${input.ip ?? NO_ADDRESS}`)
    .digest("hex")
    .slice(0, CLIENT_ID_LENGTH);
}

/**
 * The client address, as the platform reports it.
 *
 * `x-forwarded-for` is only trustworthy where something in front of the
 * application overwrites it rather than appending to it, which is what Vercel
 * does — so the first entry is the real client and not a value the client chose.
 * The two more specific headers are preferred where present because they carry
 * one address and cannot be misread.
 *
 * A missing address is returned as null rather than guessed at. Guessing would
 * put every visitor in one bucket without saying so.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const direct = first(headers.get("x-vercel-forwarded-for")) ?? first(headers.get("x-real-ip"));
  if (direct) return direct;
  return first(headers.get("x-forwarded-for"));
}

function first(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.split(",")[0]?.trim();
  return candidate ? candidate : null;
}
