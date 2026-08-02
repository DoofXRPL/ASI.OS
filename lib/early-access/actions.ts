"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { recordEarlyAccessRequest } from "@/lib/db/early-access";
import {
  coerceFormValues,
  earlyAccessRequestSchema,
  readEarlyAccessForm,
  type EarlyAccessField,
} from "@/lib/schemas/early-access";
import { fieldErrorsFrom } from "@/lib/schemas/form";
import { clientIpFromHeaders, hashClientId, utcDayKey } from "./client-id";
import type { EarlyAccessFormState } from "./form-state";
import { getIntakeKey } from "./intake-key";
import { intakeEvent, logIntake, type IntakeOutcome } from "./log";

/**
 * The public page's only write.
 *
 * The form validates as it is filled in; this validates everything again,
 * because the form is a convenience and the server is the boundary. Beyond that
 * it stays thin, and deliberately does not decide anything it cannot enforce:
 * the rate limit is counted in PostgreSQL, where every instance of this
 * deployment can see the same count, and this function only reports what the
 * database decided.
 *
 * There is still no audit event — the trail belongs to an account and there is
 * no account here — no revalidation, and no redirect. What is new is a line of
 * structured log per submission, carrying an outcome, a correlation id and a
 * keyed digest of the caller, and nothing anybody typed.
 */

/**
 * A field no person will ever see, and no person should ever fill in.
 *
 * Named unlike anything a browser autofills and hidden from assistive
 * technology, so the only thing likely to complete it is a script submitting
 * every input it finds. A filled honeypot is answered exactly as a real
 * submission would be — telling a bot which rule it tripped is how the next
 * attempt gets past it — and is recorded as what it was.
 */
const HONEYPOT_FIELD = "asi_hp";

/**
 * Used to key the caller's digest when no intake key is configured.
 *
 * Nothing is recorded in that state, so this value only ever reaches a log line;
 * it exists because an unkeyed hash of an address is a reversible one, and a log
 * is not the place to relax that. Being per-process makes the digest useless for
 * counting, which is correct: there is nothing to count.
 */
const FALLBACK_PEPPER = randomBytes(32).toString("hex");

export async function requestEarlyAccessAction(
  _previous: EarlyAccessFormState,
  formData: FormData,
): Promise<EarlyAccessFormState> {
  const startedAt = Date.now();
  const correlationId = randomUUID();
  const client = await currentClient();

  const record = (
    outcome: IntakeOutcome,
    extra: { fields?: readonly string[]; code?: string } = {},
  ): void =>
    logIntake(
      intakeEvent({
        correlationId,
        outcome,
        client,
        durationMs: Date.now() - startedAt,
        ...extra,
      }),
    );

  const honeypot = formData.get(HONEYPOT_FIELD);
  if (typeof honeypot === "string" && honeypot.trim() !== "") {
    record("honeypot");
    return { status: "recorded", error: null };
  }

  const submitted = readEarlyAccessForm(formData);
  const parsed = earlyAccessRequestSchema.safeParse(submitted);

  if (!parsed.success) {
    const fieldErrors = fieldErrorsFrom(parsed.error) as Partial<
      Record<EarlyAccessField, string>
    >;
    record("invalid", { fields: Object.keys(fieldErrors) });

    return {
      status: "rejected",
      error: null,
      fieldErrors,
      values: coerceFormValues(submitted),
    };
  }

  const written = await recordEarlyAccessRequest(parsed.data, client);
  record(written.outcome, written.code ? { code: written.code } : {});

  if (written.outcome === "accepted") {
    return { status: "recorded", error: null };
  }

  const values = coerceFormValues(submitted);

  switch (written.outcome) {
    case "throttled":
      return {
        status: "throttled",
        error:
          "Too many requests have arrived from this connection. Nothing was saved, and sending this again in a few minutes will work.",
        values,
      };
    case "unconfigured":
      return {
        status: "unavailable",
        error:
          "Requests are not being recorded right now: this deployment is not configured to receive them. Nothing was sent, and the repository is the reliable way to follow development in the meantime.",
        values,
      };
    // A refusal means the database did not recognise this deployment, and a
    // failure means something broke. Both are ours to fix and neither is
    // something the visitor can act on, so they read the same sentence — one
    // that says what happened to their answers and what is safe to do next.
    default:
      return {
        status: "rejected",
        error:
          "That request could not be recorded. Nothing was saved, so trying again is safe.",
        values,
      };
  }
}

/**
 * The caller, as the meter will count them: a keyed digest of the address and
 * today's date, never the address.
 *
 * The intake key doubles as the digest key. One secret is one thing to rotate,
 * and the two uses are separated inside `hashClientId` so neither can be
 * mistaken for the other.
 */
async function currentClient(): Promise<string> {
  const requestHeaders = await headers();

  return hashClientId({
    ip: clientIpFromHeaders(requestHeaders),
    dayKey: utcDayKey(new Date()),
    pepper: getIntakeKey() ?? FALLBACK_PEPPER,
  });
}
