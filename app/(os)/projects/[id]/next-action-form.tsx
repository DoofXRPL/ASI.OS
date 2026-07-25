"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { setNextActionAction } from "../actions";
import { EMPTY_PROJECT_STATE, type ProjectFormState } from "../form-state";

/**
 * The one field a project cannot do without.
 *
 * Clearing it is allowed and meaningful — it says the next step is genuinely
 * unknown — and Today will then say so rather than pretending the project is
 * moving.
 */
export function NextActionForm({
  projectId,
  nextAction,
}: {
  projectId: string;
  nextAction: string | null;
}) {
  const [state, formAction, pending] = useActionState<ProjectFormState, FormData>(
    setNextActionAction,
    EMPTY_PROJECT_STATE,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field
        label="Next action"
        htmlFor="nextAction"
        hint="One concrete thing. Empty means you do not yet know, which Today will say out loud."
        error={state.fieldErrors?.nextAction}
      >
        <Textarea
          id="nextAction"
          name="nextAction"
          rows={2}
          maxLength={280}
          defaultValue={nextAction ?? ""}
          placeholder="What moves this forward?"
        />
      </Field>

      <div className="flex items-center gap-3">
        <Button type="submit" pending={pending} pendingLabel="Saving…">
          Save next action
        </Button>
        <p aria-live="polite" className="text-xs text-confirmed">
          {state.savedAt !== null && !state.error ? "Saved." : ""}
        </p>
      </div>
    </form>
  );
}
