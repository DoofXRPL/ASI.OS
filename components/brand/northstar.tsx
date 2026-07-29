import { cn } from "@/components/ui/cn";

/**
 * The ASI mark: a north star, blacked out.
 *
 * The star itself is filled with the page background rather than with ink, so it
 * reads as a silhouette cut out of the light behind it. That is the whole idea of
 * the product in one shape — the system is a fixed point you navigate by, and it
 * holds nothing of its own.
 *
 * The glow is drawn in CSS rather than as an SVG gradient on purpose: gradient
 * `id`s collide when a mark appears more than once on a page, and a server
 * component cannot call `useId` to make them unique.
 */

/** Concave four-point star, longer on the vertical axis, as a compass rose is. */
const STAR_PATH =
  "M32 1 C33.6 20.5 39.4 27.2 63 32 C39.4 36.8 33.6 43.5 32 63 C30.4 43.5 24.6 36.8 1 32 C24.6 27.2 30.4 20.5 32 1 Z";

/** The same shape at a quarter turn and a third of the reach: the minor rays. */
const MINOR_RAYS_PATH =
  "M32 12 C32.7 26.9 35.2 29.6 52 32 C35.2 34.4 32.7 37.1 32 52 C31.3 37.1 28.8 34.4 12 32 C28.8 29.6 31.3 26.9 32 12 Z";

export function NorthstarMark({
  className,
  /** The halo and the slow drift. Off wherever the mark is only an identifier. */
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
    >
      {animated ? (
        <>
          <span className="pointer-events-none absolute inset-[-140%] animate-halo rounded-full bg-[radial-gradient(circle,var(--color-accent)_0%,transparent_62%)] opacity-[0.14] blur-2xl" />
          <span className="pointer-events-none absolute inset-[-25%] animate-spin-slow rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,var(--color-accent)_18deg,transparent_46deg,transparent_360deg)] opacity-[0.22] blur-md" />
        </>
      ) : null}

      <svg
        viewBox="0 0 64 64"
        fill="none"
        className={cn("relative h-full w-full", animated && "animate-breathe")}
      >
        {/* The rim light: the same star, one step out, so only its edge shows. */}
        <path d={STAR_PATH} className="fill-ink-muted/45" />
        <path
          d={STAR_PATH}
          className="fill-void"
          transform="translate(32 32) scale(0.955) translate(-32 -32)"
        />
        <path d={MINOR_RAYS_PATH} className="fill-ink-faint/25" />
        <path
          d={MINOR_RAYS_PATH}
          className="fill-void"
          transform="translate(32 32) scale(0.9) translate(-32 -32)"
        />
        <circle cx="32" cy="32" r="1.6" className="fill-accent/70" />
      </svg>
    </span>
  );
}

/** The mark with the name beside it. `full` spells the name out. */
export function Wordmark({
  full = false,
  className,
}: {
  full?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <NorthstarMark className="size-6" />
      <span className="flex flex-col leading-none">
        <span className="text-sm font-medium tracking-tight text-ink">ASI OS</span>
        {full ? (
          <span className="mt-1 text-[11px] tracking-tight text-ink-faint">
            Adaptive Systems Interface
          </span>
        ) : null}
      </span>
    </span>
  );
}
