import type { ComponentPropsWithRef } from "react";
import { cn } from "@/components/ui/cn";

/**
 * Text controls for the light site.
 *
 * `components/ui/field.tsx` holds the equivalents for the application, which
 * is dark; these are the same geometry in the site palette, one step larger.
 * Sixteen-pixel text is not a style choice — anything smaller makes iOS zoom
 * the page on focus, which throws away the layout mid-form.
 *
 * The focus state replaces the global outline rather than adding to it: the
 * border goes from hairline grey to near-black and a soft ring appears
 * outside it, so focus is unmissable without a second competing rectangle.
 */
export const SITE_CONTROL = cn(
  "w-full rounded-lg border border-edge-strong bg-panel px-3.5 text-base text-carbon",
  "placeholder:text-mist/90",
  "transition-[border-color,box-shadow] duration-[var(--duration-hover)] ease-[var(--ease-out)]",
  "hover:border-carbon/35",
  "focus:border-carbon focus:ring-4 focus:ring-carbon/8 focus:outline-none",
  "disabled:cursor-not-allowed disabled:bg-wash disabled:text-mist",
  // Named by the field so the wrapper can colour a label without knowing the
  // control's internals.
  "aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:ring-danger/12",
);

export function SiteInput({ className, ...rest }: ComponentPropsWithRef<"input">) {
  return <input {...rest} className={cn(SITE_CONTROL, "h-12", className)} />;
}

/**
 * Grows with what is being written. The growth is CSS (`field-sizing:
 * content`), not JavaScript, so it behaves correctly before hydration and the
 * `rows` attribute remains a working floor where the property is unsupported.
 */
export function SiteTextarea({
  className,
  rows = 3,
  ...rest
}: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      {...rest}
      rows={rows}
      className={cn(
        SITE_CONTROL,
        "field-grows max-h-80 resize-y py-3 leading-relaxed",
        className,
      )}
    />
  );
}
