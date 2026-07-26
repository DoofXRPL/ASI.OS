import type { ZodError } from "zod";

/**
 * The first message per field, keyed by field name.
 *
 * Zod's own `flatten()` cannot describe a discriminated union — the shape of
 * the errors depends on which branch was taken, so the type becomes a union of
 * every branch's field set and no property is safely readable. Walking the
 * issues directly is both simpler and honest about what is being produced: one
 * message per field, in the order the validator found them.
 *
 * Only the first message per field is kept. Three complaints about one input is
 * three chances to misread which one to fix.
 */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key !== "string") continue;
    if (key in errors) continue;
    errors[key] = issue.message;
  }

  return errors;
}
