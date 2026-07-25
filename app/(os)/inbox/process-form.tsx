"use client";

import { useActionState, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  INBOX_KINDS,
  PROCESS_ROUTE_LABELS,
  describeKind,
  suggestProjectName,
  type ProcessRoute,
} from "@/lib/schemas/inbox";
import { processInboxItemAction } from "./actions";
import { EMPTY_PROCESS_STATE, type ProcessFormState } from "./form-state";

export interface ProjectOption {
  id: string;
  name: string;
}

/**
 * What this capture is for.
 *
 * The routes offered are the routes that are possible: with no projects yet,
 * attaching to one is not shown, because a control that cannot succeed is a
 * control that lies. Fields appear only for the chosen route, so the form is
 * never longer than the decision being made.
 *
 * Without JavaScript the default route still submits — the form is a real
 * Server Action form, not a fetch wrapper.
 */
export function ProcessForm({
  itemId,
  content,
  projects,
  projectsUnavailable = false,
}: {
  itemId: string;
  content: string;
  projects: ProjectOption[];
  /**
   * True when the project list could not be read, as opposed to being empty.
   * The two must not be described the same way: "you have none" is a claim
   * about your records, and it would be false.
   */
  projectsUnavailable?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ProcessFormState, FormData>(
    processInboxItemAction,
    EMPTY_PROCESS_STATE,
  );

  const hasProjects = projects.length > 0;
  const [route, setRoute] = useState<ProcessRoute>("start_project");

  const routes: ProcessRoute[] = hasProjects
    ? ["start_project", "next_action", "attach", "archive"]
    : ["start_project", "archive"];

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="itemId" value={itemId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-ink-muted">
          What is this for?
        </legend>
        {routes.map((option) => (
          <label
            key={option}
            className="flex min-h-9 items-center gap-2.5 text-sm text-ink"
          >
            <input
              type="radio"
              name="route"
              value={option}
              checked={route === option}
              onChange={() => setRoute(option)}
              className="size-3.5 accent-[var(--color-accent)]"
            />
            {PROCESS_ROUTE_LABELS[option]}
          </label>
        ))}
        {hasProjects ? null : (
          <p className="text-xs text-ink-faint">
            {projectsUnavailable
              ? "Your projects could not be read just now, so routing this to one is not offered. Capturing and archiving are unaffected."
              : "Attaching to a project is not offered because you have none yet."}
          </p>
        )}
      </fieldset>

      {route === "start_project" ? (
        <Field
          label="Project name"
          htmlFor={`projectName-${itemId}`}
          hint="Taken from your capture. Edit it — the capture itself will not change."
          error={state.fieldErrors?.projectName}
        >
          <Input
            id={`projectName-${itemId}`}
            name="projectName"
            defaultValue={suggestProjectName(content)}
            maxLength={120}
            required
          />
        </Field>
      ) : null}

      {route === "next_action" || route === "attach" ? (
        <Field
          label="Project"
          htmlFor={`projectId-${itemId}`}
          error={state.fieldErrors?.projectId}
        >
          <Select id={`projectId-${itemId}`} name="projectId" required>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      {route === "next_action" ? (
        <Field
          label="Next action"
          htmlFor={`nextAction-${itemId}`}
          hint="Prefilled from your capture, because a next action has to fit on one line and a thought does not."
          error={state.fieldErrors?.nextAction}
        >
          <Textarea
            id={`nextAction-${itemId}`}
            name="nextAction"
            rows={2}
            maxLength={280}
            defaultValue={content.slice(0, 280)}
            required
          />
        </Field>
      ) : null}

      <Field
        label="Classify (optional)"
        htmlFor={`kind-${itemId}`}
        hint="Left blank, it stays unclassified. ASI does not guess."
        error={state.fieldErrors?.kind}
      >
        <Select id={`kind-${itemId}`} name="kind" defaultValue="">
          <option value="">Unclassified</option>
          {INBOX_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {describeKind(kind)}
            </option>
          ))}
        </Select>
      </Field>

      <Button type="submit" variant="primary" pending={pending} pendingLabel="Saving…">
        {PROCESS_ROUTE_LABELS[route]}
      </Button>
    </form>
  );
}
