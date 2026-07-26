"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/audit/log";
import { requireAuthedSession } from "@/lib/auth/session";
import {
  createProject,
  getProject,
  setNextAction,
  setProjectOutcome,
  setProjectStatus,
} from "@/lib/db/projects";
import { fieldErrorsFrom } from "@/lib/schemas/form";
import {
  describeProjectStatus,
  nextActionSchema,
  projectCreateSchema,
  projectOutcomeSchema,
  projectStatusSchema,
} from "@/lib/schemas/projects";
import type { NewProjectFormState, ProjectFormState } from "./form-state";

/**
 * Changing a project.
 *
 * Each action records what actually changed. Where nothing changed, nothing is
 * written: an audit trail that logs saves rather than changes slowly stops
 * being a record of what happened and becomes a record of who clicked.
 */

function refresh(projectId?: string): void {
  revalidatePath("/projects");
  revalidatePath("/today");
  revalidatePath("/activity");
  if (projectId) revalidatePath(`/projects/${projectId}`);
}

export async function createProjectAction(
  _previous: NewProjectFormState,
  formData: FormData,
): Promise<NewProjectFormState> {
  const session = await requireAuthedSession();

  const parsed = projectCreateSchema.safeParse({
    name: formData.get("name") ?? "",
    outcome: formData.get("outcome") ?? "",
  });

  if (!parsed.success) {
    const errors = fieldErrorsFrom(parsed.error);
    return {
      error: null,
      fieldErrors: { name: errors.name, outcome: errors.outcome },
    };
  }

  const result = await createProject(session.user.id, parsed.data);
  if (!result.ok) return { error: result.error };

  await recordActivity(session.user.id, {
    eventType: "project.created",
    summary: `Started project “${result.data.name}”`,
    subjectType: "project",
    subjectId: result.data.id,
    detail: { outcomeRecorded: result.data.outcome !== null },
  });

  refresh(result.data.id);
  // Redirect rather than return: the next useful thing is naming the action
  // that moves this forward, and that lives on the project itself.
  redirect(`/projects/${result.data.id}`);
}

export async function setNextActionAction(
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const session = await requireAuthedSession();

  const parsed = nextActionSchema.safeParse({
    projectId: formData.get("projectId") ?? "",
    nextAction: formData.get("nextAction") ?? "",
  });

  if (!parsed.success) {
    const errors = fieldErrorsFrom(parsed.error);
    return {
      error: errors.projectId ?? null,
      savedAt: null,
      fieldErrors: { nextAction: errors.nextAction },
    };
  }

  const current = await getProject(session.user.id, parsed.data.projectId);
  if (!current.ok) return { error: current.error, savedAt: null };
  if (!current.data) {
    return { error: "No such project in your records.", savedAt: null };
  }
  if (current.data.next_action === parsed.data.nextAction) {
    return { error: null, savedAt: Date.now() };
  }

  const result = await setNextAction(
    session.user.id,
    parsed.data.projectId,
    parsed.data.nextAction,
  );
  if (!result.ok) return { error: result.error, savedAt: null };

  await recordActivity(session.user.id, {
    eventType:
      result.data.next_action === null
        ? "project.next_action_cleared"
        : "project.next_action_set",
    summary:
      result.data.next_action === null
        ? `Cleared the next action for “${result.data.name}”`
        : `Next action for “${result.data.name}”: ${result.data.next_action}`,
    subjectType: "project",
    subjectId: result.data.id,
    detail: { hadPrevious: current.data.next_action !== null },
  });

  refresh(result.data.id);
  return { error: null, savedAt: Date.now() };
}

export async function saveProjectOutcomeAction(
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const session = await requireAuthedSession();

  const parsed = projectOutcomeSchema.safeParse({
    projectId: formData.get("projectId") ?? "",
    outcome: formData.get("outcome") ?? "",
  });

  if (!parsed.success) {
    const errors = fieldErrorsFrom(parsed.error);
    return {
      error: errors.projectId ?? null,
      savedAt: null,
      fieldErrors: { outcome: errors.outcome },
    };
  }

  const current = await getProject(session.user.id, parsed.data.projectId);
  if (!current.ok) return { error: current.error, savedAt: null };
  if (!current.data) {
    return { error: "No such project in your records.", savedAt: null };
  }
  if (current.data.outcome === parsed.data.outcome) {
    return { error: null, savedAt: Date.now() };
  }

  const result = await setProjectOutcome(
    session.user.id,
    parsed.data.projectId,
    parsed.data.outcome,
  );
  if (!result.ok) return { error: result.error, savedAt: null };

  await recordActivity(session.user.id, {
    eventType: "project.outcome_updated",
    summary:
      result.data.outcome === null
        ? `Cleared the outcome for “${result.data.name}”`
        : `Outcome for “${result.data.name}” updated`,
    subjectType: "project",
    subjectId: result.data.id,
    detail: { outcomeRecorded: result.data.outcome !== null },
  });

  refresh(result.data.id);
  return { error: null, savedAt: Date.now() };
}

export async function setProjectStatusAction(
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const session = await requireAuthedSession();

  const parsed = projectStatusSchema.safeParse({
    projectId: formData.get("projectId") ?? "",
    status: formData.get("status") ?? "",
    blockedReason: formData.get("blockedReason") ?? "",
  });

  if (!parsed.success) {
    const errors = fieldErrorsFrom(parsed.error);
    return {
      error: errors.projectId ?? null,
      savedAt: null,
      fieldErrors: {
        status: errors.status,
        blockedReason: errors.blockedReason,
      },
    };
  }

  const current = await getProject(session.user.id, parsed.data.projectId);
  if (!current.ok) return { error: current.error, savedAt: null };
  if (!current.data) {
    return { error: "No such project in your records.", savedAt: null };
  }

  const unchanged =
    current.data.status === parsed.data.status &&
    current.data.blocked_reason === parsed.data.blockedReason;
  if (unchanged) return { error: null, savedAt: Date.now() };

  const result = await setProjectStatus(
    session.user.id,
    parsed.data.projectId,
    parsed.data.status,
    parsed.data.blockedReason,
  );
  if (!result.ok) return { error: result.error, savedAt: null };

  await recordActivity(session.user.id, {
    eventType: "project.status_changed",
    summary: describeStatusChange(
      result.data.name,
      current.data.status,
      result.data.status,
      result.data.blocked_reason,
    ),
    subjectType: "project",
    subjectId: result.data.id,
    detail: { from: current.data.status, to: result.data.status },
  });

  refresh(result.data.id);
  return { error: null, savedAt: Date.now() };
}

function describeStatusChange(
  name: string,
  from: string,
  to: string,
  blockedReason: string | null,
): string {
  const change = `“${name}” moved from ${describeProjectStatus(from).toLowerCase()} to ${describeProjectStatus(to).toLowerCase()}`;
  // The reason is part of what changed, so it belongs in the record of the
  // change rather than only on the row it will later be edited off.
  return blockedReason ? `${change}: ${blockedReason}` : change;
}
