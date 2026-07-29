"use client";

import { useEffect } from "react";

/**
 * Scroll state, published once and read everywhere.
 *
 * Writes two unitless variables on <html>: `--scroll-progress` (0..1 through
 * the document) and `--scroll-y` (pixels). The bar this renders consumes the
 * first; the ambient layers consume the second for scroll parallax. One
 * passive listener, coalesced to one write per frame.
 *
 * The bar is state rather than decoration — where you are in a page you chose
 * to read — so it stays under reduced motion; it never animates on its own,
 * it only reflects.
 */
export function ScrollProgress() {
  useEffect(() => {
    const style = document.documentElement.style;
    let frame = 0;

    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      style.setProperty("--scroll-y", window.scrollY.toFixed(0));
      style.setProperty(
        "--scroll-progress",
        max > 0 ? Math.min(1, window.scrollY / max).toFixed(4) : "0",
      );
    };

    const request = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", request, { passive: true });
    window.addEventListener("resize", request);
    return () => {
      window.removeEventListener("scroll", request);
      window.removeEventListener("resize", request);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return <div aria-hidden="true" className="scroll-progress" />;
}
