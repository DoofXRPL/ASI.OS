import { z } from "zod";

/**
 * The vocabulary of the audit trail.
 *
 * `activity_events.event_type` is an unconstrained text column in the database
 * on purpose: an audit write must never fail because a new event type has not
 * been added to a CHECK constraint. Losing the record of what happened is worse
 * than storing a label the interface does not yet recognise.
 *
 * Validation therefore lives here, and the interface degrades gracefully when it
 * meets an event type it does not know.
 *
 * Only events that Phase 0 can actually emit are listed. This list grows one
 * phase at a time.
 */
export const ACTIVITY_EVENT_TYPES = [
  "auth.signed_in",
  "auth.signed_out",
  "profile.updated",
  "settings.updated",
  "inbox.captured",
  "inbox.processed",
  "inbox.archived",
  "project.created",
  "project.next_action_set",
  "project.next_action_cleared",
  "project.status_changed",
  "project.outcome_updated",
] as const;

export type ActivityEventType = (typeof ACTIVITY_EVENT_TYPES)[number];

export const ACTIVITY_ACTORS = ["user", "agent", "system"] as const;
export type ActivityActor = (typeof ACTIVITY_ACTORS)[number];

/** Human-readable labels. Unknown types fall back to the raw value. */
const EVENT_LABELS: Record<ActivityEventType, string> = {
  "auth.signed_in": "Signed in",
  "auth.signed_out": "Signed out",
  "profile.updated": "Identity updated",
  "settings.updated": "Settings updated",
  "inbox.captured": "Captured",
  "inbox.processed": "Capture processed",
  "inbox.archived": "Capture archived",
  "project.created": "Project started",
  "project.next_action_set": "Next action set",
  "project.next_action_cleared": "Next action cleared",
  "project.status_changed": "Project status changed",
  "project.outcome_updated": "Project outcome updated",
};

export function describeEventType(eventType: string): string {
  return EVENT_LABELS[eventType as ActivityEventType] ?? eventType;
}

export function isKnownEventType(value: string): value is ActivityEventType {
  return (ACTIVITY_EVENT_TYPES as readonly string[]).includes(value);
}

export const activityWriteSchema = z.object({
  eventType: z.enum(ACTIVITY_EVENT_TYPES),
  summary: z.string().trim().min(1).max(500),
  actor: z.enum(ACTIVITY_ACTORS).default("user"),
  subjectType: z.string().trim().min(1).max(60).nullish(),
  subjectId: z.uuid().nullish(),
  detail: z.record(z.string(), z.unknown()).default({}),
});

export type ActivityWrite = z.input<typeof activityWriteSchema>;
