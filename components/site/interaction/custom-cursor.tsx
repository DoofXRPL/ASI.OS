"use client";

import { useEffect } from "react";

/**
 * The custom cursor: an accent dot exactly on the pointer, and a ring trailing
 * it on the shared lerp from `PointerRoot`. All movement is CSS consuming the
 * pointer variables — this component's own work is only the three states worth
 * naming: over something interactive, pressed, and gone.
 *
 * It appears only after `PointerRoot` has seen a real mouse, so touch visitors
 * keep their native experience, and reduced motion never grows a trailing ring
 * because the variables it follows are never written.
 */
export function CustomCursor() {
  useEffect(() => {
    const html = document.documentElement;

    const onOver = (event: PointerEvent) => {
      const target = event.target;
      const interactive =
        target instanceof Element &&
        target.closest("a, button, [role='button'], summary") !== null;
      html.toggleAttribute("data-cursor-hover", interactive);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") html.setAttribute("data-cursor-down", "");
    };
    const onUp = () => html.removeAttribute("data-cursor-down");

    document.addEventListener("pointerover", onOver, { passive: true });
    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });

    return () => {
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      html.removeAttribute("data-cursor-hover");
      html.removeAttribute("data-cursor-down");
    };
  }, []);

  return (
    <>
      <div aria-hidden="true" className="cursor-dot" />
      <div aria-hidden="true" className="cursor-ring">
        <span />
      </div>
    </>
  );
}
