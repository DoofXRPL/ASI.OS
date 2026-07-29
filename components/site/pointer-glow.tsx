"use client";

import { useEffect, useRef } from "react";

/**
 * A soft light that follows the pointer across the page.
 *
 * It writes CSS custom properties on one element instead of re-rendering, so
 * pointer movement never enters React's work loop.
 *
 * The gate is the first mouse movement itself, not a media query. `(hover: hover)
 * and (pointer: fine)` looks like the right test and is not: Chrome reports it
 * false on X11 sessions with no advertised pointer device, which silently disabled
 * this on the machine it was first reviewed on. A real mouse moving is the only
 * evidence worth acting on — a touch-only device never sends one, and reduced
 * motion opts out before the listener is attached at all.
 */
export function PointerGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let x = 0;
    let y = 0;

    const paint = () => {
      frame = 0;
      node.style.setProperty("--pointer-x", `${x}px`);
      node.style.setProperty("--pointer-y", `${y}px`);
      node.style.opacity = "1";
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 opacity-0 transition-opacity duration-700"
      style={{
        background:
          "radial-gradient(520px circle at var(--pointer-x, 50%) var(--pointer-y, 0px), color-mix(in oklab, var(--color-accent) 13%, transparent), transparent 68%)",
      }}
    />
  );
}
