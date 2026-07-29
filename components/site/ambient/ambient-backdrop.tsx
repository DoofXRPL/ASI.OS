import { Depth } from "@/components/site/interaction/depth";

/**
 * The ambient layer: everything behind the interface, in one fixed component.
 *
 * Five layers, each with a reason and a depth. The grid gives the black a
 * structure; two slow lights keep it from being static; the stars belong to a
 * mark that is a star to navigate by; the noise stops large dark areas from
 * banding. Nearer layers carry more pointer travel and more scroll drift, which
 * is the whole illusion of depth — and the variables driving them are the same
 * eased pair the cursor ring follows, so the room and the cursor move together.
 *
 * All CSS: gradients, one inline SVG, compositor-only transforms. Canvas or
 * WebGL would buy nothing here but a tax on the battery — this whole layer
 * costs no script per frame.
 */
export function AmbientBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      {/* Furthest back: the survey grid, barely moved by the pointer. */}
      <Depth pointer={8} scroll={0.02} className="absolute -inset-[4%]">
        <div className="absolute inset-0 ambient-grid opacity-70" />
      </Depth>

      {/*
       * Two slow lights: the system thinking, and the system settled.
       *
       * The softness is painted into the gradient, not applied as blur(): a
       * Gaussian over a radial gradient looks the same as a longer falloff, and
       * a filter on a permanently animating layer is re-rasterised forever —
       * measured here as the difference between ~35fps and 60 on a machine
       * without GPU compositing.
       */}
      <Depth pointer={26} scroll={0.06} className="absolute inset-0">
        <div className="absolute top-[-18%] left-1/2 h-[36rem] w-[52rem] -translate-x-1/2 animate-drift bg-[radial-gradient(ellipse_50%_50%_at_center,var(--color-accent)_0%,transparent_72%)] opacity-[0.12]" />
      </Depth>
      <Depth pointer={18} scroll={0.04} className="absolute inset-0">
        <div className="absolute top-[24%] right-[4%] h-[22rem] w-[26rem] animate-drift bg-[radial-gradient(ellipse_50%_50%_at_center,var(--color-confirmed)_0%,transparent_72%)] opacity-[0.06] [animation-delay:-9s]" />
      </Depth>

      {/* Nearest texture: the star field. */}
      <Depth pointer={14} scroll={0.03} className="absolute -inset-[2%]">
        <div className="absolute inset-0 animate-twinkle ambient-stars opacity-60" />
      </Depth>

      {/* Noise reads as material, not as motion, so it holds still. */}
      <div className="absolute inset-0 ambient-noise opacity-[0.03]" />
    </div>
  );
}
