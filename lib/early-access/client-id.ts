import { createHmac } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";

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
 *     `access.intake_counters.bucket` constrains itself to. An address cannot be
 *     written to that column even by a caller trying to.
 *
 * What is hashed is a *network*, not an address — see `clientBucket`.
 */

/** Matches the check constraint on `access.intake_counters.bucket`. */
export const CLIENT_ID_LENGTH = 32;

/** Everything hashed here is separated from any other use of the same key. */
const DOMAIN = "asi.intake.client";

/**
 * What stands in for an address when there is none — a local request, a platform
 * that did not forward one, or a forwarded value that is not an address at all.
 * Everyone in that position shares a bucket, which is the safe direction to be
 * wrong in: a shared bucket is stricter than a private one.
 */
const NO_ADDRESS = "unattributed";

export function utcDayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/**
 * How many leading bits of an IPv6 address identify one subscriber.
 *
 * A /64 is the smallest subnet an IPv6 site is ever given — RFC 4291 fixes the
 * interface identifier at 64 bits, and RFC 6177 has providers hand out /56 or
 * shorter. Every address inside one therefore belongs to a single customer, who
 * can bind any of its 18 quintillion values at will.
 *
 * Hashing the exact address gave each of those values its own budget, which made
 * `per_client_max` inapplicable to anyone on IPv6: measured against this
 * deployment, 60 submissions rotating through one /64 were all accepted where 5
 * was the limit, and 200 rows — the entire deployment-wide ceiling — went in from
 * one machine in under three seconds.
 *
 * IPv4 is deliberately *not* truncated. A /24 there is up to 256 unrelated
 * subscribers of a carrier or a host, so bucketing one would refuse strangers for
 * each other's traffic; and an IPv4 address is already shared by everyone behind
 * a NAT, which makes it no coarser than an IPv6 /64 to begin with. Rotating IPv4
 * needs addresses an attacker must actually acquire, which is a different and much
 * higher cost than binding another address in a block they already hold. The
 * deployment-wide ceiling is what answers a genuinely distributed flood.
 */
const IPV6_BUCKET_BITS = 64;

/**
 * The network a request came from, in a form two addresses on the same network
 * agree on.
 *
 * Returns null for anything that is not an address, so a forwarded header
 * carrying a made-up token cannot become an identity of its own. That matters
 * wherever nothing in front of the application overwrites the header.
 */
export function clientBucket(ip: string | null): string | null {
  if (!ip) return null;
  const value = ip.trim().replace(/^\[|\]$/g, "");

  if (isIPv4(value)) return value;
  if (!isIPv6(value)) return null;

  const groups = expandIPv6(value);
  if (!groups) return null;

  // An IPv4 address written in IPv6 form is an IPv4 address, and bucketing its
  // /64 would put a sixth of the internet in one bucket.
  const mapped = mappedIPv4(groups);
  if (mapped) return mapped;

  const kept = IPV6_BUCKET_BITS / 16;
  return `${groups.slice(0, kept).join(":")}::/${IPV6_BUCKET_BITS}`;
}

/** The eight groups of an IPv6 address, each lower-case and without leading zeroes. */
function expandIPv6(value: string): string[] | null {
  let text = value;

  // A trailing dotted quad — `::ffff:203.0.113.7` — is the low 32 bits written
  // in IPv4 notation. Rewrite it as two groups so there is one shape to handle.
  const embedded = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (embedded) {
    const octets = embedded.slice(1, 5).map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    const [a = 0, b = 0, c = 0, d = 0] = octets;
    text =
      text.slice(0, embedded.index) +
      [((a << 8) | b).toString(16), ((c << 8) | d).toString(16)].join(":");
  }

  const halves = text.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 ? (halves[1] ? halves[1].split(":") : []) : null;

  const groups =
    tail === null
      ? head
      : [...head, ...Array.from({ length: 8 - head.length - tail.length }, () => "0"), ...tail];

  if (groups.length !== 8) return null;

  const normalised = groups.map((group) => {
    const parsed = Number.parseInt(group, 16);
    return Number.isNaN(parsed) ? null : parsed.toString(16);
  });

  return normalised.includes(null) ? null : (normalised as string[]);
}

/** The IPv4 address an `::ffff:a.b.c.d` group list stands for, or null. */
function mappedIPv4(groups: string[]): string | null {
  const prefix = groups.slice(0, 5).every((group) => group === "0") && groups[5] === "ffff";
  if (!prefix) return null;

  const high = Number.parseInt(groups[6] ?? "0", 16);
  const low = Number.parseInt(groups[7] ?? "0", 16);
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

export function hashClientId(input: {
  ip: string | null;
  dayKey: string;
  pepper: string;
}): string {
  return createHmac("sha256", input.pepper)
    .update(`${DOMAIN}\n${input.dayKey}\n${clientBucket(input.ip) ?? NO_ADDRESS}`)
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
 *
 * Nothing here validates the value, and nothing can: a header is only as
 * trustworthy as whatever last wrote it. `clientBucket` is what refuses to treat
 * an unparseable value as an identity, which is the part that matters — a
 * deployment behind nothing at all then meters every forged caller together
 * rather than giving each one its own budget.
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
