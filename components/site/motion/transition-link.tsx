"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ComponentProps, type MouseEvent } from "react";
import { MOTION } from "@/lib/site/motion";

const LEAVING = "data-page-leaving";

/**
 * A link that lets the page finish leaving before it navigates.
 *
 * The exit is the entrance in reverse — up, out, and blurred, on the exit curve
 * — applied by CSS when this sets `data-page-leaving` on <html>. Navigation is
 * deferred by exactly the page duration token, so the router takes over on the
 * transition's final frame rather than mid-thought.
 *
 * It degrades to a plain link in every case where the theatre would cost
 * something real: modified clicks, other pointers' buttons, reduced motion,
 * and no JavaScript at all.
 */
export function TransitionLink({
  href,
  onClick,
  children,
  ...rest
}: ComponentProps<typeof Link>) {
  const router = useRouter();

  // A back-navigation restored from cache must never arrive still faded out.
  useEffect(() => {
    const restore = () => document.documentElement.removeAttribute(LEAVING);
    window.addEventListener("pageshow", restore);
    return () => window.removeEventListener("pageshow", restore);
  }, []);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    event.preventDefault();
    const html = document.documentElement;
    html.setAttribute(LEAVING, "");

    window.setTimeout(() => {
      router.push(typeof href === "string" ? href : (href.pathname ?? "/"));
      // <html> outlives the soft navigation, so the flag must not.
      window.setTimeout(() => html.removeAttribute(LEAVING), MOTION.durationPageMs * 3);
    }, MOTION.durationPageMs);
  };

  return (
    <Link {...rest} href={href} onClick={handleClick}>
      {children}
    </Link>
  );
}
