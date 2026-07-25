import type { ProjectRow } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProjectStatus } from "@/lib/schemas/projects";
import type { ReadResult, WriteResult } from "./result";

/**
 * Projects, read and written as the signed-in caller.
 *
 * Row Level Security is what makes these queries private; the `user_id` filters
 * are defence in depth. Every write returns the row it produced so the caller
 * can record what actually changed rather than what it intended to change.
 */

const NOT_CONFIGURED = "Supabase is not configured.";

/**
 * A human touched this project. Written explicitly rather than by trigger, so
 * "recently active" cannot be set by a background write, and so ordering by it
 * means what the interface says it means.
 */
function touched(): { last_touched_at: string } {
  return { last_touched_at: new Date().toISOString() };
}

export async function listProjects(
  userId: string,
): Promise<ReadResult<ProjectRow[]>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .order("last_touched_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

/** Resolves to `null` when no such project exists *for this caller*. */
export async function getProject(
  userId: string,
  projectId: string,
): Promise<ReadResult<ProjectRow | null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("user_id", userId)
    .eq("id", projectId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? null };
}

export async function createProject(
  userId: string,
  project: { name: string; outcome: string | null },
): Promise<WriteResult<ProjectRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: userId,
      name: project.name,
      outcome: project.outcome,
    })
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "The project could not be created." };
  return { ok: true, data };
}

export async function setNextAction(
  userId: string,
  projectId: string,
  nextAction: string | null,
): Promise<WriteResult<ProjectRow>> {
  return updateProject(userId, projectId, { next_action: nextAction, ...touched() });
}

export async function setProjectOutcome(
  userId: string,
  projectId: string,
  outcome: string | null,
): Promise<WriteResult<ProjectRow>> {
  return updateProject(userId, projectId, { outcome, ...touched() });
}

/**
 * Status and blocker move together, because the database refuses to hold one
 * without the other: blocking requires a reason, and every other status clears
 * it so a solved blocker cannot be displayed later as if it still applied.
 */
export async function setProjectStatus(
  userId: string,
  projectId: string,
  status: ProjectStatus,
  blockedReason: string | null,
): Promise<WriteResult<ProjectRow>> {
  return updateProject(userId, projectId, {
    status,
    blocked_reason: status === "blocked" ? blockedReason : null,
    ...touched(),
  });
}

async function updateProject(
  userId: string,
  projectId: string,
  patch: Partial<
    Pick<
      ProjectRow,
      "name" | "outcome" | "status" | "next_action" | "blocked_reason" | "last_touched_at"
    >
  >,
): Promise<WriteResult<ProjectRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", projectId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  // Zero rows means the project is not yours or does not exist. Both are the
  // same answer from here, which is what keeps this from being a way to test
  // whether an identifier exists.
  if (!data) return { ok: false, error: "No such project in your records." };
  return { ok: true, data };
}
