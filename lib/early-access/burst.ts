/**
 * A token bucket, kept in memory, used by the proxy to refuse a flood before it
 * reaches any application code.
 *
 * Pure apart from the map it owns: `now` is passed in rather than read, so the
 * refill arithmetic is testable without waiting for time to pass. Nothing here
 * is persisted and nothing is logged — a bucket key is a client address held in
 * volatile memory for as long as it takes to refill, and that is the only place
 * in this feature where an address exists at all.
 */

export interface BurstPolicy {
  /** Requests allowed back to back, from cold. */
  capacity: number;
  /** How long one token takes to come back. */
  refillMs: number;
  /** How many callers one instance will remember at once. */
  maxTracked: number;
}

export interface BurstDecision {
  allowed: boolean;
  /** How long until the next request would be allowed. Zero when it already is. */
  retryAfterMs: number;
}

export interface BurstLimiter {
  take(key: string, now: number): BurstDecision;
  /** How many callers are currently remembered. Exposed for tests only. */
  tracked(): number;
}

interface Bucket {
  tokens: number;
  at: number;
}

export function createBurstLimiter(policy: BurstPolicy): BurstLimiter {
  const buckets = new Map<string, Bucket>();

  return {
    take(key, now) {
      const bucket = buckets.get(key) ?? { tokens: policy.capacity, at: now };

      // Refill for the time that has passed, never above the brim. Fractional
      // tokens are kept: rounding them away would make the sustained rate
      // depend on how the requests happened to be spaced.
      const refilled = Math.min(
        policy.capacity,
        bucket.tokens + Math.max(0, now - bucket.at) / policy.refillMs,
      );

      if (refilled < 1) {
        buckets.set(key, { tokens: refilled, at: now });
        return {
          allowed: false,
          retryAfterMs: Math.ceil((1 - refilled) * policy.refillMs),
        };
      }

      if (!buckets.has(key)) makeRoom(buckets, policy, now);
      buckets.set(key, { tokens: refilled - 1, at: now });
      return { allowed: true, retryAfterMs: 0 };
    },

    tracked() {
      return buckets.size;
    },
  };
}

/**
 * Keeps the map bounded.
 *
 * Buckets that have refilled to the brim carry no information — a caller with a
 * full bucket is indistinguishable from one that has never called — so they are
 * dropped first. If that is not enough, the least recently seen bucket goes,
 * which is the one whose owner is most likely to have finished.
 */
function makeRoom(buckets: Map<string, Bucket>, policy: BurstPolicy, now: number): void {
  if (buckets.size < policy.maxTracked) return;

  for (const [key, bucket] of buckets) {
    if (bucket.tokens + (now - bucket.at) / policy.refillMs >= policy.capacity) {
      buckets.delete(key);
    }
  }

  while (buckets.size >= policy.maxTracked) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [key, bucket] of buckets) {
      if (bucket.at < oldestAt) {
        oldestAt = bucket.at;
        oldestKey = key;
      }
    }
    if (oldestKey === null) return;
    buckets.delete(oldestKey);
  }
}
