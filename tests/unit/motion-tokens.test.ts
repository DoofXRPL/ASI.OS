import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MOTION, staggerDelayMs } from "@/lib/site/motion";

/**
 * The stylesheet owns the motion language; `lib/site/motion.ts` mirrors the
 * values script code needs. Two sources of the same number is exactly the kind
 * of drift that ends with staggers computed at one speed and rendered at
 * another — so the mirror is held to the stylesheet here, token by token.
 */
const css = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`${name}:\\s*([^;]+);`));
  expect(match?.[1], `expected ${name} in app/globals.css`).toBeDefined();
  return (match?.[1] ?? "").replace(/\s+/g, " ").trim();
}

describe("the motion token mirror", () => {
  it("matches every duration in the stylesheet", () => {
    expect(token("--duration-hover")).toBe(`${MOTION.durationHoverMs}ms`);
    expect(token("--duration-reveal")).toBe(`${MOTION.durationRevealMs}ms`);
    expect(token("--motion-stagger-step")).toBe(`${MOTION.staggerStepMs}ms`);
  });

  it("matches the distance and the curve", () => {
    expect(token("--motion-distance")).toBe(`${MOTION.distancePx}px`);
    expect(token("--ease-out")).toBe(MOTION.easeOut);
  });

  it("holds the language to entrance-only motion", () => {
    // The old direction had exit transitions and blur; this one does not.
    expect(css).not.toMatch(/--duration-page|--ease-exit|--motion-blur/);
  });
});

describe("stagger arithmetic", () => {
  it("steps in whole multiples of the token", () => {
    expect(staggerDelayMs(0)).toBe(0);
    expect(staggerDelayMs(1)).toBe(MOTION.staggerStepMs);
    expect(staggerDelayMs(6)).toBe(6 * MOTION.staggerStepMs);
  });

  it("never yields a negative delay", () => {
    expect(staggerDelayMs(-3)).toBe(0);
  });
});
