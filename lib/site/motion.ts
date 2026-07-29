/**
 * The motion language, for code that cannot read CSS.
 *
 * `app/globals.css` is the source of truth for every duration, distance and
 * curve on the front page. Script code sometimes needs the same numbers — a
 * stagger delay computed per item — so the shared ones are mirrored here.
 *
 * A mirror can lie, which is why `tests/unit/motion-tokens.test.ts` parses the
 * stylesheet and fails the moment either side changes without the other.
 */
export const MOTION = {
  /** Every entrance: a short rise and a fade, nothing else. */
  easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",

  durationHoverMs: 150,
  durationRevealMs: 550,

  staggerStepMs: 60,
  distancePx: 12,
} as const;

export function staggerDelayMs(index: number): number {
  return Math.max(0, Math.round(index)) * MOTION.staggerStepMs;
}
