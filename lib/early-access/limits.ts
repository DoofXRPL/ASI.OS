/**
 * What the front door will accept before it reads anything.
 *
 * These two numbers describe the same limit twice, because Next.js wants a size
 * as a string and a request header gives one as a count of bytes. A unit test
 * holds them to each other, since a body limit that disagrees with the check in
 * front of it is a check that either never fires or fires on real submissions.
 *
 * 64 KB is deliberately generous. The longest possible request is roughly 4.5
 * thousand characters across the two free-text answers, which is around 18 KB
 * if every one of them is a four-byte character, and the same limit applies to
 * every other Server Action in the application — the longest of those is a 4000
 * character capture. What it rules out is the megabyte-scale body, which has no
 * legitimate version on this form and costs the same to send as a small one.
 */
export const INTAKE_MAX_BODY_BYTES = 64 * 1024;

/** The same limit in the notation `experimental.serverActions` expects. */
export const INTAKE_BODY_SIZE_LIMIT = "64kb" as const;

/**
 * Burst protection at the edge: a token bucket, ten deep, refilling one token
 * every six seconds.
 *
 * The depth is what a person can reach and no more — ten submissions in a row,
 * which is already more attempts than correcting a form takes — and the refill
 * rate is what they can sustain. A script wanting a thousand rows an hour wants
 * six times that.
 *
 * This is the first layer and the weakest, because the bucket lives in one
 * server instance's memory and a deployment has several. It is here because it
 * is free and it stops the crude case in the cheapest possible place; the limit
 * that actually holds is the one in `access.intake_limits`, which is counted in
 * PostgreSQL where every instance can see it.
 */
export const INTAKE_BURST = {
  capacity: 10,
  refillMs: 6_000,
  /**
   * How many callers one instance will remember. Reached only under a
   * distributed flood, at which point the oldest bucket is forgotten to make
   * room — bounded memory matters more than a perfect count, given the
   * authoritative count is in the database.
   */
  maxTracked: 5_000,
} as const;
