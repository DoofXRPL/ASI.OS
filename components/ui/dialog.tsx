"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * A modal, built on the native `<dialog>` element.
 *
 * Two constraints shape this component, and both look like refactor targets:
 *
 *  1. `open` is never forwarded to the element. A rendered `<dialog open>` is a
 *     *non-modal* dialog: no focus trap, no inert background, not in the top
 *     layer. Only `showModal()` produces a real modal, so the prop drives that
 *     method and the attribute is left entirely to the browser.
 *  2. Children stay mounted while the dialog is closed, so a half-written draft
 *     inside survives being dismissed. Rendering them conditionally would make
 *     dismissal and discarding the same gesture.
 *
 * Everything else a modal needs — Escape, the focus trap, returning focus to
 * whatever opened it, marking the rest of the page inert — is the platform's,
 * which is the reason for using the element rather than a div.
 */
export function Dialog({
  open,
  onDismiss,
  labelledBy,
  className,
  children,
}: {
  open: boolean;
  /** Called for every way out: Escape, the backdrop, the browser closing it. */
  onDismiss: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;

    // Guarded both ways: showModal() on an open dialog throws, and close() on a
    // closed one fires a spurious `close` event.
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      className={cn("text-ink", className)}
      onCancel={(event) => {
        // Escape is reported rather than obeyed. Letting the browser close the
        // dialog directly would leave React's `open` saying otherwise, and then
        // the next open would be a no-op.
        event.preventDefault();
        onDismiss();
      }}
      onClose={onDismiss}
      onClick={(event) => {
        // The backdrop is not an element, so a click on it targets the dialog
        // itself. Anything inside targets a descendant. This holds only while
        // the dialog has no padding of its own — see `.capture-sheet`.
        if (event.target === ref.current) onDismiss();
      }}
    >
      {children}
    </dialog>
  );
}
