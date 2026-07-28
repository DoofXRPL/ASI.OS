"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { isApplePlatform } from "@/components/os/capture-shortcut";
import { cn } from "./cn";

/**
 * One key on a keyboard.
 *
 * Mono, like every other machine fact in this interface: a key is something the
 * hardware has, not a word in a sentence.
 */
export function Kbd({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-4 items-center justify-center rounded border border-line-strong",
        "bg-raised px-1 font-mono text-[10px] leading-4 text-ink-muted",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

// The platform cannot change while the page is open, so there is nothing to
// subscribe to and the unsubscribe is a no-op. Defined once at module scope
// because a new function on every render would make the store look unstable.
const subscribe = () => () => {};

const clientSnapshot = () => isApplePlatform(navigator.platform);

// The server has no platform to read. Rendering the Control form first is the
// honest default: it is correct for most keyboards, and it is a label rather
// than a behaviour, so being briefly generic costs nothing. Either modifier
// works whatever this says.
const serverSnapshot = () => false;

/**
 * Whether this is an Apple keyboard.
 *
 * Read through `useSyncExternalStore` rather than an effect. Detecting the
 * platform in an effect means writing state from an effect — which
 * `react-hooks/set-state-in-effect` forbids, and for good reason: it renders
 * once with a value known to be wrong. This hook lets React ask for the value
 * during the render that needs it, with a defined answer for the server.
 */
export function useIsApplePlatform(): boolean {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
