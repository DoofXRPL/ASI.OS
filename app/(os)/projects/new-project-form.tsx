"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { createProjectAction } from "./actions";
import { EMPTY_NEW_PROJECT_STATE, type NewProjectFormState } from "./form-state";

/**
 * Starting a project asks for a name and, optionally, what it is for.
 *
 * The next action is deliberately not asked for here. It is the one field that
 * has to stay current, and answering it at the moment of creation — before the
 * project is real — is how it becomes stale.
 */
export function NewProjectForm() {
  const [state, formAction, pending] = useActionState<NewProjectFormState, FormData>(
    createProjectAction,
    EMPTY_NEW_PROJECT_STATE,
  );

  return (
    <form action={formAction} className="max-w-measure space-y-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field label="Name" htmlFor="name" error={state.fieldErrors?.name}>
        <Input id="name" name="name" maxLength={120} required autoComplete="off" />
      </Field>

      <Field
        label="Outcome"
        htmlFor="outcome"
        hint="What will be true when this is done? Optional, and you can write it later."
        error={state.fieldErrors?.outcome}
      >
        <Textarea id="outcome" name="outcome" rows={2} maxLength={2000} />
      </Field>

      <Button type="submit" variant="primary" pending={pending} pendingLabel="Starting…">
        Start project
      </Button>
    </form>
  );
}
