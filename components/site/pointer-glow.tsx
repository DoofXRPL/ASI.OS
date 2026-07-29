"use client";

import { useEffect, useRef } from "react";

/**
 * A soft light that follows the pointer across the hero.
 *
 * It writes CSS custom properties on one element instead of re-rendering, so
 * pointer movement never enters React's work loop, and it is skipped entirely for
 * touch input and for anyone who has asked for less motion — on a device without a
 * pointer it would be a light that follows nothing.
 */
export function PointerGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || calm) return;

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
          "radial-gradient(420px circle at var(--pointer-x, 50%) var(--pointer-y, 0px), color-mix(in oklab, var(--color-accent) 9%, transparent), transparent 70%)",
      }}
    />
  );
}
