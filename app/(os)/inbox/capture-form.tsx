"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CAPTURE_MAX_CHARACTERS,
  captureCharactersLeft,
} from "@/lib/schemas/inbox";
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
export function CaptureForm({
  id,
  autoFocus = false,
}: {
  /**
   * Required rather than defaulted, because this form appears twice on
   * `/inbox` — inline and inside the quick capture sheet. A shared default
   * would put two elements with the same id in one document, and the label,
   * the shortcut and every `getElementById` would resolve to whichever came
   * first.
   */
  id: string;
  autoFocus?: boolean;
}) {
  const [state, formAction, pending] = useActionState<CaptureFormState, FormData>(
    captureInboxItemAction,
    EMPTY_CAPTURE_STATE,
  );

  const formRef = useRef<HTMLFormElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const [length, setLength] = useState(0);
  const left = captureCharactersLeft(length);

  useEffect(() => {
    if (state.capturedAt === null) return;
    formRef.current?.reset();
    fieldRef.current?.focus();
  }, [state.capturedAt]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-2.5"
      // The counter follows the field's own reset rather than being cleared
      // alongside it. `reset()` above fires this, and so does a reset the
      // browser performs on its own, so the count cannot disagree with the
      // field it describes.
      onReset={() => setLength(0)}
    >
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <label htmlFor={id} className="sr-only">
        Capture a thought
      </label>
      <Textarea
        ref={fieldRef}
        id={id}
        name="content"
        rows={2}
        maxLength={CAPTURE_MAX_CHARACTERS}
        autoFocus={autoFocus}
        required
        placeholder="Anything. A task, a question, a link, a half-formed idea."
        onChange={(event) => setLength(event.currentTarget.value.length)}
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
        <div className="flex items-center gap-3">
          {left !== null ? (
            <p
              className={
                left <= 50 ? "font-mono text-xs text-attention" : "font-mono text-xs text-ink-faint"
              }
            >
              {left} left
            </p>
          ) : null}
          <Button type="submit" variant="primary" pending={pending} pendingLabel="Capturing…">
            Capture
          </Button>
        </div>
      </div>

      {/* Announced rather than merely shown, since the field is cleared and the
          only other evidence of success is further down the page. */}
      <p aria-live="polite" className="text-xs text-confirmed">
        {state.capturedAt !== null && !state.error ? "Captured." : "\u00A0"}
      </p>
    </form>
  );
}
