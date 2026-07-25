"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { saveProjectOutcomeAction } from "../actions";
import { EMPTY_PROJECT_STATE, type ProjectFormState } from "../form-state";

/** What will be true when this project is done. */
export function OutcomeForm({
  projectId,
  outcome,
}: {
  projectId: string;
  outcome: string | null;
}) {
  const [state, formAction, pending] = useActionState<ProjectFormState, FormData>(
    saveProjectOutcomeAction,
    EMPTY_PROJECT_STATE,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field
        label="Outcome"
        htmlFor="outcome"
        hint="What will be true when this is finished?"
        error={state.fieldErrors?.outcome}
      >
        <Textarea
          id="outcome"
          name="outcome"
          rows={3}
          maxLength={2000}
          defaultValue={outcome ?? ""}
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" pending={pending} pendingLabel="Saving…">
          Save outcome
        </Button>
        <p aria-live="polite" className="text-xs text-confirmed">
          {state.savedAt !== null && !state.error ? "Saved." : ""}
        </p>
      </div>
    </form>
  );
}
