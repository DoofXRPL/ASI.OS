"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  PROJECT_STATUSES,
  STATUS_MEANINGS,
  describeProjectStatus,
  isProjectStatus,
  type ProjectStatus,
} from "@/lib/schemas/projects";
import { setProjectStatusAction } from "../actions";
import { EMPTY_PROJECT_STATE, type ProjectFormState } from "../form-state";

/**
 * Status, and the reason that has to come with one of them.
 *
 * The reason field appears when — and only when — blocked is selected, because
 * the database will refuse the write otherwise. Asking for it at the moment of
 * blocking is the difference between a blocker you can act on and a project
 * that has quietly stopped.
 */
export function StatusForm({
  projectId,
  status,
  blockedReason,
}: {
  projectId: string;
  status: string;
  blockedReason: string | null;
}) {
  const [state, formAction, pending] = useActionState<ProjectFormState, FormData>(
    setProjectStatusAction,
    EMPTY_PROJECT_STATE,
  );

  const [selected, setSelected] = useState<ProjectStatus>(
    isProjectStatus(status) ? status : "active",
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="projectId" value={projectId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <Field
        label="Status"
        htmlFor="status"
        hint={STATUS_MEANINGS[selected]}
        error={state.fieldErrors?.status}
      >
        <Select
          id="status"
          name="status"
          value={selected}
          onChange={(event) => setSelected(event.target.value as ProjectStatus)}
        >
          {PROJECT_STATUSES.map((option) => (
            <option key={option} value={option}>
              {describeProjectStatus(option)}
            </option>
          ))}
        </Select>
      </Field>

      {selected === "blocked" ? (
        <Field
          label="What is blocking it?"
          htmlFor="blockedReason"
          hint="Required. This sentence is what Today will show you, in your words."
          error={state.fieldErrors?.blockedReason}
        >
          <Textarea
            id="blockedReason"
            name="blockedReason"
            rows={2}
            maxLength={500}
            defaultValue={blockedReason ?? ""}
            required
          />
        </Field>
      ) : blockedReason !== null ? (
        <p className="max-w-measure text-xs text-ink-faint">
          Saving this will clear the recorded blocker, so it cannot be shown
          later as though it still applied.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" pending={pending} pendingLabel="Saving…">
          Save status
        </Button>
        <p aria-live="polite" className="text-xs text-confirmed">
          {state.savedAt !== null && !state.error ? "Saved." : ""}
        </p>
      </div>
    </form>
  );
}
