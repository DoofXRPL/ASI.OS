/**
 * The result of a write.
 *
 * Writes return a result rather than throwing so callers are forced to decide what
 * the reader should be told. A swallowed error becomes a form that appears to have
 * saved, which is the kind of quiet dishonesty this product cannot afford.
 */
export type WriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * The result of a read.
 *
 * Reads carry the same obligation as writes. Returning an empty array when a
 * query fails makes a broken database indistinguishable from an empty account,
 * and "you have nothing" is the more damaging of the two to get wrong: it is a
 * confident statement about someone's records that happens to be false.
 */
export type ReadResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Narrowing helper so pages can branch without repeating the discriminant. */
export function isFailure<T>(
  result: ReadResult<T> | WriteResult<T>,
): result is { ok: false; error: string } {
  return !result.ok;
}
