import { cn } from "@/components/ui/cn";

/**
 * The ASI mark: a north star, blacked out.
 *
 * On dark surfaces the star is filled with the page background and reads as a
 * silhouette cut out of the light behind it; on the light site it is simply a
 * solid near-black star. Both are the same idea — a fixed point to navigate
 * by that holds nothing of its own — with no glow, no rotation, no theatre.
 */

/** Concave four-point star, longer on the vertical axis, as a compass rose is. */
const STAR_PATH =
  "M32 1 C33.6 20.5 39.4 27.2 63 32 C39.4 36.8 33.6 43.5 32 63 C30.4 43.5 24.6 36.8 1 32 C24.6 27.2 30.4 20.5 32 1 Z";

/** The same shape at a quarter turn and a third of the reach: the minor rays. */
const MINOR_RAYS_PATH =
  "M32 12 C32.7 26.9 35.2 29.6 52 32 C35.2 34.4 32.7 37.1 32 52 C31.3 37.1 28.8 34.4 12 32 C28.8 29.6 31.3 26.9 32 12 Z";

export type MarkVariant = "dark" | "light";

export function NorthstarMark({
  className,
  /** `dark` sits on the application's near-black; `light` on the site's paper. */
  variant = "dark",
}: {
  className?: string;
  variant?: MarkVariant;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
    >
      <svg viewBox="0 0 64 64" fill="none" className="relative h-full w-full">
        {variant === "dark" ? (
          <>
            {/*
             * The rim is the same star with a smaller copy punched out of it,
             * rather than a stroke: a stroke would thin away at the points, and
             * this keeps the outline in proportion down to a 24px header mark.
             */}
            <path d={STAR_PATH} className="fill-ink-muted/70" />
            <path
              d={STAR_PATH}
              className="fill-void"
              transform="translate(32 32) scale(0.9) translate(-32 -32)"
            />
            <path d={MINOR_RAYS_PATH} className="fill-ink-faint/40" />
            <path
              d={MINOR_RAYS_PATH}
              className="fill-void"
              transform="translate(32 32) scale(0.8) translate(-32 -32)"
            />
            <circle cx="32" cy="32" r="2" className="fill-accent/80" />
          </>
        ) : (
          <>
            <path d={MINOR_RAYS_PATH} className="fill-graphite/45" />
            <path d={STAR_PATH} className="fill-carbon" />
            <circle cx="32" cy="32" r="2" className="fill-accent" />
          </>
        )}
      </svg>
    </span>
  );
}

/** The mark with the name beside it. `caption` adds the Northstar attribution. */
export function Wordmark({
  variant = "dark",
  caption = false,
  className,
}: {
  variant?: MarkVariant;
  caption?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <NorthstarMark variant={variant} className="size-6" />
      <span className="flex items-baseline gap-2 leading-none">
        <span
          className={cn(
            "text-sm font-semibold tracking-tight",
            variant === "light" ? "text-carbon" : "text-ink",
          )}
        >
          ASI.OS
        </span>
        {caption ? (
          <span
            className={cn(
              "text-[11px] tracking-tight",
              variant === "light" ? "text-mist" : "text-ink-faint",
            )}
          >
            by Northstar Labs
          </span>
        ) : null}
      </span>
    </span>
  );
}
