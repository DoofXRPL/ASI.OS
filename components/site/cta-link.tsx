import type { ComponentProps } from "react";
import { cn } from "@/components/ui/cn";
import { Magnetic } from "./interaction/magnetic";
import { TransitionLink } from "./motion/transition-link";

/**
 * The front page's two link-buttons, stated once.
 *
 * Internal destinations leave through the page transition and lean toward the
 * pointer; the styling itself stays in the static layer and draws only on
 * tokens. There is deliberately no third variant — a page with one real action
 * does not need a palette of buttons.
 */
const VARIANTS = {
  primary:
    "bg-accent text-void hover:bg-accent/90",
  secondary:
    "border border-line-strong bg-raised text-ink hover:border-ink-faint",
} as const;

export function CtaLink({
  variant = "primary",
  className,
  children,
  ...rest
}: ComponentProps<typeof TransitionLink> & {
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <Magnetic>
      <TransitionLink
        {...rest}
        className={cn(
          "inline-flex h-10 items-center rounded-md px-4 text-sm font-medium",
          "transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)]",
          VARIANTS[variant],
          className,
        )}
      >
        {children}
      </TransitionLink>
    </Magnetic>
  );
}
