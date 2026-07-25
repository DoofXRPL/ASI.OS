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
