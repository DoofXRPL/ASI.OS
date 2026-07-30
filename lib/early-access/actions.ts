"use server";

import { recordEarlyAccessRequest } from "@/lib/db/early-access";
import {
  coerceFormValues,
  earlyAccessRequestSchema,
  readEarlyAccessForm,
  type EarlyAccessField,
} from "@/lib/schemas/early-access";
import { fieldErrorsFrom } from "@/lib/schemas/form";
import type { EarlyAccessFormState } from "./form-state";

/**
 * The public page's only write.
 *
 * The form validates as it is filled in; this validates everything again,
 * because the form is a convenience and the server is the boundary. Beyond
 * that it does as little as possible: no audit event (the trail belongs to an
 * account and there is no account here), no revalidation (nothing renders
 * these rows), no redirect (the page changes in place).
 */

/**
 * A field no person will ever see, and no person should ever fill in.
 *
 * Named unlike anything a browser autofills and hidden from assistive
 * technology, so the only thing likely to complete it is a script submitting
 * every input it finds. A filled honeypot is answered exactly as a real
 * submission would be — telling a bot which rule it tripped is how the next
 * attempt gets past it.
 */
const HONEYPOT_FIELD = "asi_hp";

export async function requestEarlyAccessAction(
  _previous: EarlyAccessFormState,
  formData: FormData,
): Promise<EarlyAccessFormState> {
  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    return { status: "recorded", error: null };
  }

  const submitted = readEarlyAccessForm(formData);
  const parsed = earlyAccessRequestSchema.safeParse(submitted);

  if (!parsed.success) {
    return {
      status: "rejected",
      error: null,
      fieldErrors: fieldErrorsFrom(parsed.error) as Partial<
        Record<EarlyAccessField, string>
      >,
      values: coerceFormValues(submitted),
    };
  }

  const written = await recordEarlyAccessRequest(parsed.data);

  if (!written.ok) {
    const values = coerceFormValues(submitted);

    return written.reason === "not_configured"
      ? {
          status: "unavailable",
          error:
            "Requests are not being recorded right now: this deployment has no database configured. Nothing was sent, and the repository is the reliable way to follow development in the meantime.",
          values,
        }
      : {
          status: "rejected",
          error:
            "That request could not be recorded. Nothing was saved, so trying again is safe.",
          values,
        };
  }

  return { status: "recorded", error: null };
}
