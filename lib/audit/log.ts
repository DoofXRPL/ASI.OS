import type { ActivityEventRow, Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { activityWriteSchema, type ActivityWrite } from "@/lib/schemas/activity";

/**
 * The audit trail.
 *
 * Two properties matter more than convenience here:
 *
 *   1. Writes are attributed by the database, not by the caller. `user_id` comes
 *      from the validated session, and the INSERT policy rejects any attempt to
 *      write history under another account.
 *   2. A failed audit write never breaks the operation it was describing. The
 *      user's action has already succeeded; throwing here would turn a
 *      bookkeeping problem into a broken feature. Failures are reported to the
 *      caller so the interface can be honest about them.
 */

export interface AuditResult {
  recorded: boolean;
  error?: string;
}

export async function recordActivity(
  userId: string,
  event: ActivityWrite,
): Promise<AuditResult> {
  const parsed = activityWriteSchema.safeParse(event);
  if (!parsed.success) {
    return { recorded: false, error: "Invalid activity event." };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { recorded: false, error: "Supabase is not configured." };
  }

  const { eventType, summary, actor, subjectType, subjectId, detail } = parsed.data;

  const { error } = await supabase.from("activity_events").insert({
    user_id: userId,
    event_type: eventType,
    summary,
    actor,
    subject_type: subjectType ?? null,
    subject_id: subjectId ?? null,
    detail: detail as Json,
  });

  if (error) return { recorded: false, error: error.message };
  return { recorded: true };
}

export interface ActivityPage {
  events: ActivityEventRow[];
  /** True when more history exists beyond the returned page. */
  hasMore: boolean;
}

export const ACTIVITY_PAGE_SIZE = 50;

/**
 * Reads the caller's own history, newest first. Row Level Security guarantees
 * that only their events can be returned; the `user_id` filter below is defence
 * in depth, not the mechanism.
 */
export async function listActivity(
  userId: string,
  options: { limit?: number; eventType?: string } = {},
): Promise<ActivityPage> {
  const limit = Math.min(Math.max(options.limit ?? ACTIVITY_PAGE_SIZE, 1), 200);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { events: [], hasMore: false };

  let query = supabase
    .from("activity_events")
    .select("*")
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(limit + 1);

  if (options.eventType) {
    query = query.eq("event_type", options.eventType);
  }

  const { data, error } = await query;
  if (error || !data) return { events: [], hasMore: false };

  return {
    events: data.slice(0, limit),
    hasMore: data.length > limit,
  };
}
