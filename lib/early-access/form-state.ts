import type {
  EarlyAccessField,
  EarlyAccessFormValues,
} from "@/lib/schemas/early-access";

/**
 * The state the early-access form renders from.
 *
 * A sibling module rather than part of `actions.ts` because a `"use server"`
 * file may only export async functions — the same reason `lib/auth/form-state.ts`
 * exists.
 */
/**
 * `throttled` is separated from `rejected` because the two call for different
 * sentences and different colours. A rejection is about the submission; being
 * rate limited is about the connection it arrived on, and the answers are fine.
 */
export type EarlyAccessStatus =
  | "idle"
  | "recorded"
  | "rejected"
  | "throttled"
  | "unavailable";

export interface EarlyAccessFormState {
  status: EarlyAccessStatus;
  /** Shown above the form. Null when the failure belongs to specific fields. */
  error: string | null;
  fieldErrors?: Partial<Record<EarlyAccessField, string>>;
  /**
   * What was submitted, sent back so a rejection does not empty the form.
   *
   * Only reached without JavaScript, where a rejection is a whole new page and
   * every uncontrolled input would otherwise return blank. Once the page has
   * hydrated the inputs are never unmounted, so their values survive on their
   * own and this is ignored.
   */
  values?: EarlyAccessFormValues;
}

export const EMPTY_EARLY_ACCESS_STATE: EarlyAccessFormState = {
  status: "idle",
  error: null,
};
