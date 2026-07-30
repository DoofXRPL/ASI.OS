import { getIntakeKey } from "@/lib/early-access/intake-key";
import type { EarlyAccessRequest } from "@/lib/schemas/early-access";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The one write an unauthenticated visitor can perform.
 *
 * It goes through `public.request_early_access()` rather than a table, because
 * the table lives in the `access` schema and is not exposed to PostgREST at
 * all. Two arguments do not come from the form:
 *
 *   * `p_key` is the deployment's intake key, and the function refuses any call
 *     that cannot produce it. Without that, the publishable key would be enough
 *     to write to the queue directly and every check on this side of the call
 *     would be a check on a path nobody had to take.
 *   * `p_client` is a keyed digest of the caller's address, which is what the
 *     function counts requests against. The address itself never leaves this
 *     process.
 *
 * The outcome is a word rather than a row. A duplicate address still reads as
 * `accepted`, so this is not a way to test whether an address is on the list;
 * what the extra outcomes distinguish is the three things a visitor deserves to
 * be told apart — recorded, rate limited, and not configured.
 *
 * See supabase/migrations/0004_intake_guard.sql.
 */

export type EarlyAccessOutcome =
  | "accepted"
  | "throttled"
  | "refused"
  | "unconfigured"
  | "failed";

export interface EarlyAccessWrite {
  outcome: EarlyAccessOutcome;
  /**
   * The database's own error code where there was one, for the log. Never its
   * message: a check violation may quote the row that failed, and that row is
   * somebody's answers.
   */
  code: string | null;
}

export async function recordEarlyAccessRequest(
  request: EarlyAccessRequest,
  client: string,
): Promise<EarlyAccessWrite> {
  const key = getIntakeKey();
  if (!key) return { outcome: "unconfigured", code: null };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { outcome: "unconfigured", code: null };

  const { data, error } = await supabase.rpc("request_early_access", {
    p_key: key,
    p_client: client,
    p_name: request.name,
    p_email: request.email,
    p_use_case: request.useCase,
    p_company: request.company ?? null,
    p_other_use_case: request.otherUseCase ?? null,
    p_team_size: request.teamSize ?? null,
    p_challenge: request.challenge ?? null,
  });

  if (error) return { outcome: "failed", code: error.code ?? null };
  return { outcome: asOutcome(data), code: null };
}

/**
 * An answer this code does not recognise is a failure, not a success.
 *
 * A future migration that adds an outcome has to add it here too, and until it
 * does the visitor is told the request could not be recorded — which is the
 * honest reading of "the database said something we cannot interpret".
 */
function asOutcome(value: unknown): EarlyAccessOutcome {
  switch (value) {
    case "accepted":
    case "throttled":
    case "refused":
    case "unconfigured":
      return value;
    default:
      return "failed";
  }
}
