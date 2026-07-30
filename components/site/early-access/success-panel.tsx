"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef } from "react";
import { EARLY_ACCESS } from "@/lib/site/early-access";
import { MOTION } from "@/lib/site/motion";

/**
 * What the form becomes once the request is recorded.
 *
 * It replaces the form in place rather than navigating, so the browser's back
 * button still means "the page before this one" and nobody lands on a
 * confirmation URL they can reload into a second submission.
 *
 * Focus moves to the heading on arrival. Without that, a keyboard or screen
 * reader user submits a form and is left with focus on a button that no longer
 * exists, with no announcement that anything happened.
 */
const EASE = [0.22, 1, 0.36, 1] as const;

export function SuccessPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();
  const arrived = useRef(false);

  useEffect(() => {
    // Runs once: `reduceMotion` resolving a moment later must not scroll the
    // page a second time under someone already reading.
    if (arrived.current) return;
    arrived.current = true;

    // The panel is scrolled into view, not the heading. Submitting happens at
    // the foot of a long form, and focusing the heading brings only the heading
    // into view — which leaves the checkmark, and its one animation, just above
    // the top of the screen.
    panelRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
    headingRef.current?.focus({ preventScroll: true });
  }, [reduceMotion]);

  const duration = reduceMotion ? 0 : MOTION.durationRevealMs / 1000;

  return (
    <motion.div
      ref={panelRef}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: MOTION.distancePx }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, ease: EASE }}
      className="rounded-xl border border-edge bg-panel px-6 py-12 text-center shadow-lift sm:px-10 sm:py-16"
    >
      <Checkmark reduceMotion={reduceMotion ?? false} />

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-7 text-2xl font-semibold tracking-[-0.02em] text-carbon outline-none md:text-[1.75rem]"
      >
        {EARLY_ACCESS.success.headline}
      </h2>

      <p className="mx-auto mt-3 max-w-sm text-[15px]/7 text-pretty text-graphite">
        {EARLY_ACCESS.success.body}
      </p>

      <p className="mt-6 font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
        {EARLY_ACCESS.success.receipt}
      </p>

      <Link
        href="/"
        className="mt-9 inline-flex h-11 items-center justify-center rounded-lg border border-edge-strong bg-panel px-5 text-sm font-medium text-carbon transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:border-carbon/45"
      >
        {EARLY_ACCESS.success.action}
      </Link>
    </motion.div>
  );
}

/**
 * A ring and a tick, drawn rather than faded in.
 *
 * Sage, because the meaning system reserves that colour for "confirmed" and
 * this is the one moment on the page where something has been.
 */
function Checkmark({ reduceMotion }: { reduceMotion: boolean }) {
  const draw = {
    hidden: { pathLength: 0, opacity: 0 },
    visible: { pathLength: 1, opacity: 1 },
  };

  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 52 52"
      className="mx-auto size-14 text-confirmed-ink"
      fill="none"
      initial={reduceMotion ? "visible" : "hidden"}
      animate="visible"
    >
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        variants={draw}
        transition={{ duration: reduceMotion ? 0 : 0.5, ease: EASE }}
      />
      <motion.path
        d="M15 27.5 L22.5 35 L37 19"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        variants={draw}
        transition={{ duration: reduceMotion ? 0 : 0.3, ease: EASE, delay: reduceMotion ? 0 : 0.32 }}
      />
    </motion.svg>
  );
}
