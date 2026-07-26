import type { ComponentPropsWithRef } from "react";
import { CONTROL } from "./field";
import { cn } from "./cn";

/**
 * A text control that grows with its content.
 *
 * The growth is CSS (`field-sizing: content`), not JavaScript, so a capture
 * field behaves correctly before hydration — which matters, because the whole
 * claim of the inbox is that capturing costs nothing.
 */
export function Textarea({
  className,
  rows = 2,
  ...rest
}: ComponentPropsWithRef<"textarea">) {
  return (
    <textarea
      {...rest}
      rows={rows}
      className={cn(CONTROL, "field-grows resize-y py-2 leading-relaxed", className)}
    />
  );
}
