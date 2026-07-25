import { describe, expect, it } from "vitest";
import {
  ACTIVITY_EVENT_TYPES,
  activityWriteSchema,
  describeEventType,
  isKnownEventType,
} from "@/lib/schemas/activity";

/**
 * The audit vocabulary. Its one hard rule is that the record outranks the
 * interface: an unrecognised event type is displayed, never dropped.
 */
describe("the event vocabulary", () => {
  it("gives every known type a human label", () => {
    for (const type of ACTIVITY_EVENT_TYPES) {
      const label = describeEventType(type);
      expect(label, `${type} has no label`).not.toBe(type);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it("covers every mutation this phase can perform", () => {
    // If a new write appears without an event type, this list is where the
    // omission becomes visible.
    expect([...ACTIVITY_EVENT_TYPES].sort()).toEqual([
      "auth.signed_in",
      "auth.signed_out",
      "inbox.archived",
      "inbox.captured",
      "inbox.processed",
      "profile.updated",
      "project.created",
      "project.next_action_cleared",
      "project.next_action_set",
      "project.outcome_updated",
      "project.status_changed",
      "settings.updated",
    ]);
  });

  it("shows an unrecognised type rather than hiding the row", () => {
    expect(isKnownEventType("memory.confirmed")).toBe(false);
    expect(describeEventType("memory.confirmed")).toBe("memory.confirmed");
  });
});

describe("writing to the trail", () => {
  it("accepts an event that names its subject", () => {
    const parsed = activityWriteSchema.safeParse({
      eventType: "inbox.captured",
      summary: "Captured “ask the surveyor”",
      subjectType: "inbox_item",
      subjectId: "44444444-4444-4444-8444-444444444444",
    });
    expect(parsed.success).toBe(true);
  });

  it("refuses a summary that says nothing", () => {
    expect(
      activityWriteSchema.safeParse({ eventType: "inbox.captured", summary: "   " })
        .success,
    ).toBe(false);
  });

  it("refuses a subject id that is not an identifier", () => {
    expect(
      activityWriteSchema.safeParse({
        eventType: "project.created",
        summary: "Started a project",
        subjectId: "the-loft",
      }).success,
    ).toBe(false);
  });

  it("defaults the actor to the person, never to the system", () => {
    const parsed = activityWriteSchema.parse({
      eventType: "project.created",
      summary: "Started a project",
    });
    expect(parsed.actor).toBe("user");
  });
});
