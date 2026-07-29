import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/components/ui/cn";

/**
 * The page's two link-buttons, stated once. Plain links with button geometry:
 * no magnetism, no exit theatre — a click navigates, immediately. There is
 * deliberately no third variant; a page with one real action does not need a
 * palette of buttons.
 */
const VARIANTS = {
  primary: "bg-carbon text-white hover:bg-carbon/85",
  secondary: "border border-edge-strong bg-panel text-carbon hover:border-carbon/45",
} as const;

export function CtaLink({
  variant = "primary",
  className,
  children,
  ...rest
}: ComponentProps<typeof Link> & {
  variant?: keyof typeof VARIANTS;
}) {
  return (
    <Link
      {...rest}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium",
        "transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)]",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}
