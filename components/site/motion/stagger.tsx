import { Children, type ReactNode } from "react";
import { Reveal, type RevealDirection } from "./reveal";

/**
 * A run of Reveals, indexed automatically.
 *
 * Wraps each direct child so a mapped list arrives one stagger step apart
 * without the call site doing delay arithmetic. `as`/`itemAs` keep real list
 * semantics — an `<ol>` of `<li>`, a `<dl>` of `<div>` groups — because the
 * motion layer must never cost the page its markup.
 */
export function Stagger({
  children,
  className,
  itemClassName,
  from = 0,
  direction = "up",
  as: Container = "div",
  itemAs = "div",
}: {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  /** Offset when the run follows other staggered content in the same view. */
  from?: number;
  direction?: RevealDirection;
  as?: "div" | "ol" | "ul" | "dl";
  itemAs?: "div" | "li" | "span";
}) {
  const items = Children.toArray(children);

  return (
    <Container className={className}>
      {items.map((child, i) => (
        <Reveal
          key={typeof child === "object" && child !== null && "key" in child && child.key != null ? child.key : i}
          as={itemAs}
          index={from + i}
          direction={direction}
          className={itemClassName}
        >
          {child}
        </Reveal>
      ))}
    </Container>
  );
}
