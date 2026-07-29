"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/components/ui/cn";
import { staggerDelayMs } from "@/lib/site/motion";
import { observeReveal } from "./observer";

export type RevealDirection = "up" | "down" | "left" | "right" | "none";

/**
 * The one entrance.
 *
 * Every arrival on the front page — the hero on load, a section on scroll — is
 * this component: rise by the token distance, shed the token blur, fade in on
 * the token curve. Call sites choose a direction and a stagger index and
 * nothing else, which is what keeps sixty entrances feeling like one decision.
 *
 * Entrance only, on purpose: content that fades out as it leaves is content the
 * reader cannot return to. The hidden state lives in CSS, so a visitor with
 * JavaScript disabled needs the `<noscript>` override on the page.
 */
export function Reveal({
  children,
  className,
  index = 0,
  direction = "up",
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  /** Position in a stagger; the delay is index × the stagger-step token. */
  index?: number;
  direction?: RevealDirection;
  /** Keeps list and definition-list semantics intact. */
  as?: "div" | "li" | "span";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => observeReveal(ref.current), []);

  const style: CSSProperties & Record<`--${string}`, string> = {};
  if (index > 0) style.transitionDelay = `${staggerDelayMs(index)}ms`;
  if (direction === "none") style["--reveal-y"] = "0px";
  if (direction === "down") style["--reveal-y"] = "calc(var(--motion-distance) * -1)";
  if (direction === "left" || direction === "right") {
    style["--reveal-y"] = "0px";
    style["--reveal-x"] =
      direction === "left" ? "var(--motion-distance)" : "calc(var(--motion-distance) * -1)";
  }

  // The three tags share every attribute used here, so one element type is
  // enough for the compiler; the browser gets the real tag either way.
  const Tag = as as "div";

  return (
    <Tag
      ref={ref}
      style={style}
      data-visible="false"
      className={cn("reveal", className)}
    >
      {children}
    </Tag>
  );
}
