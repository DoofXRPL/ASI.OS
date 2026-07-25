"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { captureInboxItemAction } from "./actions";
import { EMPTY_CAPTURE_STATE, type CaptureFormState } from "./form-state";

/**
 * One field, and nothing to decide.
 *
 * Everything about this form exists to keep capture free: no kind, no project,
 * no title. The field clears and refocuses after a capture so a second thought
 * costs nothing either, and ⌘/Ctrl+Enter submits without leaving the keyboard.
 *
 * It also works before hydration. A Server Action form posts natively, so the
 * moment the page is on screen it can take a thought.
 */
export function CaptureForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const [state, formAction, pending] = useActionState<CaptureFormState, FormData>(
    captureInboxItemAction,
    EMPTY_CAPTURE_STATE,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.capturedAt === null) return;
    formRef.current?.reset();
    fieldRef.current?.focus();
  }, [state.capturedAt]);

  return (
    <form ref={formRef} action={formAction} className="space-y-2.5">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <label htmlFor="capture" className="sr-only">
        Capture a thought
      </label>
      <Textarea
        ref={fieldRef}
        id="capture"
        name="content"
        rows={2}
        maxLength={4000}
        autoFocus={autoFocus}
        required
        placeholder="Anything. A task, a question, a link, a half-formed idea."
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-faint">
          Stored exactly as written. Nothing here is edited, summarised or
          classified without you.
        </p>
        <Button type="submit" variant="primary" pending={pending} pendingLabel="Capturing…">
          Capture
        </Button>
      </div>

      {/* Announced rather than merely shown, since the field is cleared and the
          only other evidence of success is further down the page. */}
      <p aria-live="polite" className="text-xs text-confirmed">
        {state.capturedAt !== null && !state.error ? "Captured." : "\u00A0"}
      </p>
    </form>
  );
}
