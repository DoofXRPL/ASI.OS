/**
 * The motion language, for code that cannot read CSS.
 *
 * `app/globals.css` is the source of truth for every duration, distance, blur
 * and curve on the front page. Script code sometimes needs the same numbers —
 * a stagger delay computed per item, a navigation deferred until the exit
 * transition has played — so the shared ones are mirrored here.
 *
 * A mirror can lie, which is why `tests/unit/motion-tokens.test.ts` parses the
 * stylesheet and fails the moment either side changes without the other.
 */
export const MOTION = {
  /** Every entrance: rise, sharpen, fade in. */
  easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  /** Every departure: the entrance in reverse, slightly eager. */
  easeExit: "cubic-bezier(0.55, 0, 0.7, 0.3)",

  durationHoverMs: 180,
  durationRevealMs: 700,
  durationPageMs: 240,

  staggerStepMs: 70,
  distancePx: 18,
  blurPx: 10,
} as const;

/**
 * Script-only tuning. These drive requestAnimationFrame loops rather than CSS
 * transitions, so they have no stylesheet counterpart to drift from.
 */
export const INTERACTION = {
  /** Fraction of the remaining distance the eased pointer covers per frame. */
  pointerLerp: 0.16,
  /** The pointer loop parks once movement falls below this, in px per frame. */
  pointerRestPx: 0.15,
  /** How far a magnetic control will travel toward the pointer, in px. */
  magneticMaxPx: 6,
  /** Pull strength: offset from centre × this, before clamping. */
  magneticStrength: 0.25,
} as const;

export function staggerDelayMs(index: number): number {
  return Math.max(0, Math.round(index)) * MOTION.staggerStepMs;
}
