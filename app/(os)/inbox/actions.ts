"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/audit/log";
import { requireAuthedSession } from "@/lib/auth/session";
import {
  captureInboxItem,
  getInboxItem,
  markInboxItemProcessed,
} from "@/lib/db/inbox";
import { createProject, getProject, setNextAction } from "@/lib/db/projects";
import { fieldErrorsFrom } from "@/lib/schemas/form";
import {
  captureSchema,
  processInboxItemSchema,
  processedIntoFor,
  type ProcessRoute,
} from "@/lib/schemas/inbox";
import type { CaptureFormState, ProcessFormState } from "./form-state";

/**
 * Capture, and the four ways out of the inbox.
 *
 * Two rules run through every action here:
 *
 *   1. The form is a convenience; this is the boundary. Everything is
 *      re-validated with Zod regardless of what the browser enforced.
 *   2. The audit trail records what actually happened, in order. Where an
 *      action does two things — starting a project and processing the capture
 *      that became it — both are recorded, because a history that summarises is
 *      a history that has begun to interpret.
 */

/** Enough of a capture to recognise it in a list of history. */
function excerpt(content: string, max = 120): string {
  const line = content.trim().split("\n")[0]?.trim() ?? "";
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
}

export async function captureInboxItemAction(
  _previous: CaptureFormState,
  formData: FormData,
): Promise<CaptureFormState> {
  const session = await requireAuthedSession();

  const parsed = captureSchema.safeParse({
    content: formData.get("content") ?? "",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "That could not be captured.",
      capturedAt: null,
    };
  }

  const result = await captureInboxItem(session.user.id, parsed.data.content);
  if (!result.ok) return { error: result.error, capturedAt: null };

  await recordActivity(session.user.id, {
    eventType: "inbox.captured",
    summary: `Captured “${excerpt(result.data.content)}”`,
    subjectType: "inbox_item",
    subjectId: result.data.id,
    detail: { characters: result.data.content.length },
  });

  revalidatePath("/inbox");
  revalidatePath("/today");
  revalidatePath("/activity");

  return { error: null, capturedAt: Date.now() };
}

export async function processInboxItemAction(
  _previous: ProcessFormState,
  formData: FormData,
): Promise<ProcessFormState> {
  const session = await requireAuthedSession();

  const parsed = processInboxItemSchema.safeParse({
    route: formData.get("route") ?? "",
    itemId: formData.get("itemId") ?? "",
    kind: formData.get("kind") ?? "",
    projectId: formData.get("projectId") ?? undefined,
    projectName: formData.get("projectName") ?? undefined,
    nextAction: formData.get("nextAction") ?? undefined,
  });

  if (!parsed.success) {
    const errors = fieldErrorsFrom(parsed.error);
    return {
      error: errors.route ?? errors.itemId ?? null,
      fieldErrors: {
        projectId: errors.projectId,
        projectName: errors.projectName,
        nextAction: errors.nextAction,
        kind: errors.kind,
      },
    };
  }

  const input = parsed.data;
  const userId = session.user.id;

  const item = await getInboxItem(userId, input.itemId);
  if (!item.ok) return { error: item.error };
  if (!item.data) return { error: "No such capture in your records." };
  if (item.data.status !== "unprocessed") {
    return { error: "That capture has already been processed." };
  }

  let projectId: string | null = null;
  let projectName = "";

  switch (input.route) {
    case "start_project": {
      const created = await createProject(userId, {
        name: input.projectName,
        outcome: null,
      });
      if (!created.ok) return { error: created.error };

      projectId = created.data.id;
      projectName = created.data.name;

      await recordActivity(userId, {
        eventType: "project.created",
        summary: `Started project “${created.data.name}” from a capture`,
        subjectType: "project",
        subjectId: created.data.id,
        detail: { fromInboxItem: item.data.id },
      });
      break;
    }

    case "next_action": {
      const project = await getProject(userId, input.projectId);
      if (!project.ok) return { error: project.error };
      if (!project.data) {
        return { fieldErrors: { projectId: "No such project in your records." }, error: null };
      }

      const updated = await setNextAction(userId, project.data.id, input.nextAction);
      if (!updated.ok) return { error: updated.error };

      projectId = updated.data.id;
      projectName = updated.data.name;

      await recordActivity(userId, {
        eventType: "project.next_action_set",
        summary: `Next action for “${updated.data.name}”: ${excerpt(input.nextAction)}`,
        subjectType: "project",
        subjectId: updated.data.id,
        detail: { fromInboxItem: item.data.id },
      });
      break;
    }

    case "attach": {
      const project = await getProject(userId, input.projectId);
      if (!project.ok) return { error: project.error };
      if (!project.data) {
        return { fieldErrors: { projectId: "No such project in your records." }, error: null };
      }

      projectId = project.data.id;
      projectName = project.data.name;
      break;
    }

    case "archive":
      break;
  }

  const processed = await markInboxItemProcessed(userId, item.data.id, {
    processedInto: processedIntoFor(input.route),
    projectId,
    kind: input.kind,
  });
  if (!processed.ok) return { error: processed.error };

  await recordActivity(userId, {
    eventType: input.route === "archive" ? "inbox.archived" : "inbox.processed",
    summary: describeProcessing(input.route, excerpt(item.data.content), projectName),
    subjectType: "inbox_item",
    subjectId: item.data.id,
    detail: {
      route: input.route,
      ...(projectId ? { projectId } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
    },
  });

  revalidatePath("/inbox");
  revalidatePath("/today");
  revalidatePath("/projects");
  revalidatePath("/activity");
  if (projectId) revalidatePath(`/projects/${projectId}`);

  return { error: null };
}

function describeProcessing(
  route: ProcessRoute,
  capture: string,
  projectName: string,
): string {
  switch (route) {
    case "start_project":
      return `“${capture}” became the project “${projectName}”`;
    case "next_action":
      return `“${capture}” became the next action for “${projectName}”`;
    case "attach":
      return `“${capture}” attached to “${projectName}”`;
    case "archive":
      return `Archived “${capture}”`;
  }
}
