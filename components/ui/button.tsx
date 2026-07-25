import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-void hover:bg-accent/90 disabled:bg-accent/40 disabled:text-void/60",
  secondary:
    "bg-raised text-ink border border-line-strong hover:border-ink-faint disabled:text-ink-faint",
  ghost: "text-ink-muted hover:text-ink hover:bg-raised disabled:text-ink-faint",
  danger:
    "bg-danger-dim text-danger border border-danger/40 hover:border-danger disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  md: "h-9 px-3.5 text-sm",
  sm: "h-7 px-2.5 text-xs",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * Replaces the label while work is in flight. The button stays the same width
   * so the layout does not jump under the pointer.
   */
  pending?: boolean;
  pendingLabel?: string;
  children: ReactNode;
}

export function Button({
  variant = "secondary",
  size = "md",
  pending = false,
  pendingLabel,
  className,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium",
        "transition-colors duration-150 disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
