"use client";

import { useEffect } from "react";
import { INTERACTION } from "@/lib/site/motion";

/**
 * The single source of pointer state.
 *
 * Writes six unitless variables on <html> — the raw position, the same position
 * eased through one lerp, and the eased position normalised to ±0.5 of the
 * viewport — and flags `data-pointer="mouse"` on the first genuine mouse
 * movement. The cursor, the spotlight and the ambient depth all consume these
 * same variables, so they cannot fall out of step with each other: there is
 * only one trailing position in the whole system.
 *
 * The gate is the movement itself, not a media query: Chrome reports
 * `(pointer: fine)` false on X11 sessions with no advertised pointer device,
 * and a touch-only device simply never sends a mouse pointermove.
 *
 * One requestAnimationFrame loop, and only while there is distance left to
 * cover; at rest this component costs nothing per frame.
 */
export function PointerRoot() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const html = document.documentElement;
    const style = html.style;

    let rawX = window.innerWidth / 2;
    let rawY = 0;
    let easedX = rawX;
    let easedY = rawY;
    let frame = 0;
    let seen = false;

    const tick = () => {
      frame = 0;
      easedX += (rawX - easedX) * INTERACTION.pointerLerp;
      easedY += (rawY - easedY) * INTERACTION.pointerLerp;

      style.setProperty("--pointer-x", rawX.toFixed(1));
      style.setProperty("--pointer-y", rawY.toFixed(1));
      style.setProperty("--pointer-ex", easedX.toFixed(2));
      style.setProperty("--pointer-ey", easedY.toFixed(2));
      style.setProperty("--pointer-nx", (easedX / window.innerWidth - 0.5).toFixed(4));
      style.setProperty("--pointer-ny", (easedY / window.innerHeight - 0.5).toFixed(4));

      const remaining = Math.abs(rawX - easedX) + Math.abs(rawY - easedY);
      if (remaining > INTERACTION.pointerRestPx) frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      if (!seen) {
        seen = true;
        html.setAttribute("data-pointer", "mouse");
      }
      html.removeAttribute("data-pointer-idle");
      rawX = event.clientX;
      rawY = event.clientY;
      if (!frame) frame = requestAnimationFrame(tick);
    };

    // The cursor and spotlight hide when the mouse leaves the document.
    const onLeave = () => html.setAttribute("data-pointer-idle", "");

    window.addEventListener("pointermove", onMove, { passive: true });
    html.addEventListener("mouseleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onMove);
      html.removeEventListener("mouseleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
      html.removeAttribute("data-pointer");
      html.removeAttribute("data-pointer-idle");
    };
  }, []);

  return null;
}
