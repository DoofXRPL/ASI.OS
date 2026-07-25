import type { InboxItemRow } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InboxKind, InboxStatus, ProcessedInto } from "@/lib/schemas/inbox";
import type { ReadResult, WriteResult } from "./result";

/**
 * Captured input, read and written as the signed-in caller.
 *
 * There is deliberately no function here that changes `content`. The column
 * carries no UPDATE privilege, so such a function could not work — the absence
 * is the guarantee, not an oversight.
 */

const NOT_CONFIGURED = "Supabase is not configured.";

export interface InboxPage {
  items: InboxItemRow[];
  /**
   * How many rows match, independent of how many were returned. A truncated
   * list must never cause an undercount, because the count is what Today says
   * out loud.
   */
  total: number;
}

export async function listInboxItems(
  userId: string,
  options: { status?: InboxStatus; limit?: number } = {},
): Promise<ReadResult<InboxPage>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };

  let query = supabase
    .from("inbox_items")
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options.status) query = query.eq("status", options.status);
  if (options.limit) query = query.limit(options.limit);

  const { data, error, count } = await query;
  if (error) return { ok: false, error: error.message };

  const items = data ?? [];
  return { ok: true, data: { items, total: count ?? items.length } };
}

/** Captures linked to one project, oldest first so they read as a record. */
export async function listInboxItemsForProject(
  userId: string,
  projectId: string,
): Promise<ReadResult<InboxItemRow[]>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("inbox_items")
    .select("*")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function getInboxItem(
  userId: string,
  itemId: string,
): Promise<ReadResult<InboxItemRow | null>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("inbox_items")
    .select("*")
    .eq("user_id", userId)
    .eq("id", itemId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? null };
}

/**
 * Stores exactly what was written. No kind, no project, no status to choose:
 * the whole value of an inbox is that using it requires no decisions.
 */
export async function captureInboxItem(
  userId: string,
  content: string,
): Promise<WriteResult<InboxItemRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("inbox_items")
    .insert({ user_id: userId, content })
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "The capture could not be saved." };
  return { ok: true, data };
}

/**
 * Records what a capture became.
 *
 * `processed_at` and `processed_into` are written together with the status
 * because the database refuses any other combination: a processed item must be
 * able to say when it left the queue and what it turned into.
 */
export async function markInboxItemProcessed(
  userId: string,
  itemId: string,
  outcome: {
    processedInto: ProcessedInto;
    projectId: string | null;
    kind: InboxKind | null;
  },
): Promise<WriteResult<InboxItemRow>> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, error: NOT_CONFIGURED };

  const { data, error } = await supabase
    .from("inbox_items")
    .update({
      status: outcome.processedInto === "archived" ? "archived" : "processed",
      processed_into: outcome.processedInto,
      processed_at: new Date().toISOString(),
      project_id: outcome.projectId,
      kind: outcome.kind,
    })
    .eq("user_id", userId)
    .eq("id", itemId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "No such capture in your records." };
  return { ok: true, data };
}
