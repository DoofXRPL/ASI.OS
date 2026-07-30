/**
 * What the front door writes down.
 *
 * The intake path has no account behind it, so it cannot use the audit trail in
 * `lib/audit/log.ts` — that trail belongs to a person and is read by them. What
 * this feature needs instead is operational: enough to answer "is the form
 * working", "was there a flood last night", and "which layer refused this", and
 * deliberately not enough to reconstruct who submitted what.
 *
 * So the record is a closed shape rather than a free object. There is no field
 * for a name, an address, an email or a message, which means none can be added
 * by accident at a call site — adding one would mean editing this file, where
 * the reason not to is written down. `tests/unit/intake-log.test.ts` holds the
 * shape to that promise.
 *
 * It goes to stdout as one JSON object per line, because that is what the
 * platform already collects. A log store is not infrastructure this product has
 * earned yet (Principle 10).
 */

/**
 * Every way a submission can end, across all three layers. One vocabulary, so a
 * count of refusals is a count of refusals however they were refused.
 */
export const INTAKE_OUTCOMES = [
  /** Recorded, or absorbed as a duplicate — the database does not say which. */
  "accepted",
  /** Refused by the meter in the database, per caller or across the deployment. */
  "throttled",
  /** Refused by the token bucket at the edge, before any application code ran. */
  "burst",
  /** A body larger than the form can produce, refused before it was read. */
  "oversize",
  /** Failed the schema. The field names are recorded; the values are not. */
  "invalid",
  /** The honeypot was filled in. Answered as a success, recorded as what it was. */
  "honeypot",
  /** The database did not recognise the caller. Misconfiguration, or a forgery. */
  "refused",
  /** No database, or no intake key. Nothing was attempted. */
  "unconfigured",
  /** Something broke. The error code is recorded; the message is not. */
  "failed",
] as const;

export type IntakeOutcome = (typeof INTAKE_OUTCOMES)[number];

export interface IntakeEvent {
  event: "early_access.intake";
  /** ISO 8601, UTC. */
  at: string;
  /** One submission, one id, so the layers that touched it can be lined up. */
  correlationId: string;
  outcome: IntakeOutcome;
  /**
   * The keyed digest from `lib/early-access/client-id.ts`, never an address.
   * Absent for events raised at the edge, which has no key to compute one with.
   */
  client?: string;
  /** Which fields a submission failed on. Names only — never what was typed. */
  fields?: readonly string[];
  /**
   * The database's own error code where there was one. Never its message: a
   * constraint violation is entitled to quote the row that caused it, and that
   * row is somebody's answers.
   */
  code?: string;
  durationMs?: number;
}

export function intakeEvent(input: {
  correlationId: string;
  outcome: IntakeOutcome;
  client?: string;
  fields?: readonly string[];
  code?: string;
  durationMs?: number;
  now?: Date;
}): IntakeEvent {
  const event: IntakeEvent = {
    event: "early_access.intake",
    at: (input.now ?? new Date()).toISOString(),
    correlationId: input.correlationId,
    outcome: input.outcome,
  };

  if (input.client) event.client = input.client;
  if (input.fields?.length) event.fields = [...input.fields];
  if (input.code) event.code = input.code;
  if (typeof input.durationMs === "number") {
    event.durationMs = Math.max(0, Math.round(input.durationMs));
  }

  return event;
}

/**
 * Outcomes worth someone's attention, sent to stderr so the platform's error
 * view surfaces them without a query. An accepted submission is not news.
 */
const NOTABLE: ReadonlySet<IntakeOutcome> = new Set<IntakeOutcome>([
  "throttled",
  "burst",
  "oversize",
  "refused",
  "unconfigured",
  "failed",
]);

export function logIntake(event: IntakeEvent): void {
  const line = JSON.stringify(event);
  if (NOTABLE.has(event.outcome)) console.warn(line);
  else console.log(line);
}
