"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CaptureForm } from "@/app/(os)/inbox/capture-form";
import { Dialog } from "@/components/ui/dialog";
import { Kbd, useIsApplePlatform } from "@/components/ui/kbd";
import {
  captureShortcutKeys,
  captureShortcutLabel,
  INLINE_CAPTURE_FIELD_ID,
  isCaptureShortcut,
  opensSheetInPlace,
  SHEET_CAPTURE_FIELD_ID,
} from "./capture-shortcut";

const HEADING_ID = "quick-capture-heading";

/**
 * Capture without losing the page that prompted the thought.
 *
 * Navigating to `/inbox` to write one line costs the reader the thing they were
 * looking at, which is the most likely reason the thought existed. So the same
 * form opens in place, over whatever surface they were on.
 *
 * The trigger is a link, not a button, and that is deliberate. Without
 * JavaScript it navigates to `/inbox#capture`, where the same form is waiting;
 * the click handler can only run once React has hydrated, and only takes over
 * for a plain click. Capture is the one thing that has to work before a bundle
 * loads.
 */
export function QuickCapture() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isApple = useIsApplePlatform();

  const dismiss = useCallback(() => setOpen(false), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isCaptureShortcut(event)) return;

      // On `/inbox` the field is already on the page. Covering it with a second
      // copy of itself would be the shortcut arguing with the surface, so the
      // shortcut just goes to the field that is already there. If that page is
      // showing a read failure instead, there is no field to go to and the
      // sheet is still the right answer.
      const inline =
        pathname === "/inbox"
          ? document.getElementById(INLINE_CAPTURE_FIELD_ID)
          : null;

      event.preventDefault();

      if (inline !== null) {
        inline.scrollIntoView({ block: "nearest" });
        inline.focus();
        return;
      }

      setOpen(true);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    // Runs after the dialog has been shown: a child's effects run before its
    // parent's, and `showModal()` lives in `Dialog`. A field inside a closed
    // dialog is not rendered and cannot take focus.
    document.getElementById(SHEET_CAPTURE_FIELD_ID)?.focus();
  }, [open]);

  return (
    <>
      <Link
        href={`/inbox#${INLINE_CAPTURE_FIELD_ID}`}
        title={`Capture a thought (${captureShortcutLabel(isApple)})`}
        onClick={(event) => {
          if (!opensSheetInPlace(event)) return;
          event.preventDefault();
          setOpen(true);
        }}
        className={[
          "flex items-center justify-between gap-2 rounded-md border border-line-strong",
          "bg-raised px-3 py-2 text-sm text-ink transition-colors duration-150",
          "hover:border-ink-faint",
        ].join(" ")}
      >
        Capture
        <span className="flex items-center gap-0.5" aria-hidden="true">
          {captureShortcutKeys(isApple).map((key) => (
            <Kbd key={key}>{key}</Kbd>
          ))}
        </span>
      </Link>

      <Dialog
        open={open}
        onDismiss={dismiss}
        labelledBy={HEADING_ID}
        className="capture-sheet"
      >
        <div className="capture-sheet-body">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 id={HEADING_ID} className="text-sm font-medium text-ink">
                Capture
              </h2>
              <p className="text-xs text-ink-muted">
                One field, no decisions. It lands in your inbox exactly as
                written.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className={[
                "-mr-1 -mt-1 shrink-0 rounded px-2 py-1 text-xs text-ink-muted",
                "transition-colors duration-150 hover:bg-raised hover:text-ink",
              ].join(" ")}
            >
              Dismiss
            </button>
          </div>

          {/*
            The form the inbox uses, not a copy of it. A second implementation
            of capture is a second thing that can start storing something other
            than what was typed.
          */}
          <CaptureForm id={SHEET_CAPTURE_FIELD_ID} />

          <p className="text-[11px] text-ink-faint">
            <Kbd>Esc</Kbd> dismisses this. Anything half-written stays here.
          </p>
        </div>
      </Dialog>
    </>
  );
}
