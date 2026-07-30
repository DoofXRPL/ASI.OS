import type { EarlyAccessRequest } from "@/lib/schemas/early-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WriteResult } from "./result";

/**
 * The one write an unauthenticated visitor can perform.
 *
 * It goes through `public.request_early_access()` rather than a table, because
 * the table lives in the `access` schema and is not exposed to PostgREST at
 * all. The function returns nothing, so there is nothing here to read back:
 * a second submission from the same address is absorbed by the database and
 * looks exactly like the first, which is what keeps the form from becoming a
 * way to test whether an address is already on the list.
 *
 * See supabase/migrations/0003_early_access.sql.
 */

/**
 * Distinguished from a failed write so the page can say which of the two it
 * is. "The database rejected this" and "this deployment has no database" call
 * for different sentences, and guessing between them is how a form ends up
 * blaming the visitor for a missing environment variable.
 */
export type EarlyAccessWriteFailure = "not_configured" | "rejected";

export async function recordEarlyAccessRequest(
  request: EarlyAccessRequest,
): Promise<WriteResult<null> & { reason?: EarlyAccessWriteFailure }> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { ok: false, error: "Supabase is not configured.", reason: "not_configured" };
  }

  const { error } = await supabase.rpc("request_early_access", {
    p_name: request.name,
    p_email: request.email,
    p_use_case: request.useCase,
    p_company: request.company ?? null,
    p_other_use_case: request.otherUseCase ?? null,
    p_team_size: request.teamSize ?? null,
    p_challenge: request.challenge ?? null,
  });

  if (error) return { ok: false, error: error.message, reason: "rejected" };
  return { ok: true, data: null };
}
