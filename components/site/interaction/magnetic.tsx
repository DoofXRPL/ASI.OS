"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { INTERACTION, MOTION } from "@/lib/site/motion";

/**
 * A control that leans toward the pointer.
 *
 * The pull is deliberately small — a few pixels, clamped — because the point is
 * that the button acknowledges you, not that it chases you. Transform-only, on
 * the wrapper, with the release easing back on the hover tokens so letting go
 * feels like every other hover on the page.
 *
 * Mouse only: a finger cannot hover, so on touch this is exactly a <span>.
 */
export function Magnetic({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const box = node.getBoundingClientRect();
      const max = INTERACTION.magneticMaxPx;
      const pull = INTERACTION.magneticStrength;
      const x = (event.clientX - (box.left + box.width / 2)) * pull;
      const y = (event.clientY - (box.top + box.height / 2)) * pull;

      node.style.transition = "none";
      node.style.transform = `translate3d(${Math.max(-max, Math.min(max, x)).toFixed(1)}px, ${Math.max(-max, Math.min(max, y)).toFixed(1)}px, 0)`;
    };

    const onLeave = () => {
      node.style.transition = `transform ${MOTION.durationHoverMs * 2}ms ${MOTION.easeOut}`;
      node.style.transform = "translate3d(0, 0, 0)";
    };

    node.addEventListener("pointermove", onMove, { passive: true });
    node.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <span ref={ref} className={cn("inline-block will-change-transform", className)}>
      {children}
    </span>
  );
}
