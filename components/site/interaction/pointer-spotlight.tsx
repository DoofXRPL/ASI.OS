/**
 * The light that follows the pointer.
 *
 * An oversized, statically painted gradient that is only ever translated —
 * moving it costs the compositor a transform, never a repaint. It reads the
 * eased pointer variables, so it trails at exactly the cursor ring's pace;
 * the two cannot drift because they follow the same number.
 *
 * No script of its own: `PointerRoot` owns the tracking, CSS owns the rest,
 * and this stays a server component.
 */
export function PointerSpotlight() {
  return <div aria-hidden="true" className="pointer-spotlight" />;
}
