import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/**
 * Parallax as pure consumption.
 *
 * Wraps a layer in a transform built from the shared pointer and scroll
 * variables: `pointer` is the layer's full travel in px across the viewport,
 * `scroll` is px of drift per px scrolled. Because the variables are already
 * eased by the interaction layer, every Depth layer trails at the same pace —
 * depth is one system, not one implementation per element.
 *
 * No listeners, no client bundle: this is a server component emitting a calc().
 * When the variables are never written (touch, reduced motion), every term is
 * zero and the wrapper is inert.
 */
export function Depth({
  children,
  className,
  pointer = 0,
  scroll = 0,
}: {
  children?: ReactNode;
  className?: string;
  /** Total pointer travel in px; positive moves with the pointer. */
  pointer?: number;
  /** Drift in px per px scrolled; positive lags behind the scroll. */
  scroll?: number;
}) {
  return (
    <div
      className={cn("will-change-transform", className)}
      style={{
        transform: `translate3d(calc(var(--pointer-nx, 0) * ${pointer}px), calc(var(--pointer-ny, 0) * ${pointer}px + var(--scroll-y, 0) * ${-scroll}px), 0)`,
      }}
    >
      {children}
    </div>
  );
}
