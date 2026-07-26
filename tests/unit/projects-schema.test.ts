import { describe, expect, it } from "vitest";
import {
  describeProjectStatus,
  isOpenStatus,
  isProjectStatus,
  nextActionSchema,
  projectCreateSchema,
  projectStatusSchema,
  PROJECT_STATUSES,
  STATUS_MEANINGS,
} from "@/lib/schemas/projects";

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

describe("starting a project", () => {
  it("requires a name and trims it", () => {
    const parsed = projectCreateSchema.safeParse({
      name: "  Loft conversion  ",
      outcome: "",
    });
    expect(parsed.success && parsed.data.name).toBe("Loft conversion");
  });

  it("refuses a name that is only whitespace", () => {
    const parsed = projectCreateSchema.safeParse({ name: "   ", outcome: "" });
    expect(parsed.success).toBe(false);
  });

  it("stores an empty outcome as absent rather than as an empty string", () => {
    const parsed = projectCreateSchema.safeParse({ name: "Loft", outcome: "   " });
    expect(parsed.success && parsed.data.outcome).toBeNull();
  });

  it("rejects a name longer than the column allows", () => {
    const parsed = projectCreateSchema.safeParse({
      name: "x".repeat(121),
      outcome: "",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("the next action", () => {
  it("accepts being cleared, because not knowing is a real answer", () => {
    const parsed = nextActionSchema.safeParse({
      projectId: PROJECT_ID,
      nextAction: "",
    });
    expect(parsed.success && parsed.data.nextAction).toBeNull();
  });

  it("keeps to one line's worth of text", () => {
    expect(
      nextActionSchema.safeParse({
        projectId: PROJECT_ID,
        nextAction: "x".repeat(281),
      }).success,
    ).toBe(false);
  });

  it("refuses a project reference that is not an identifier", () => {
    expect(
      nextActionSchema.safeParse({ projectId: "the-loft", nextAction: "Call" })
        .success,
    ).toBe(false);
  });
});

describe("changing status", () => {
  it("refuses to block a project without saying why", () => {
    const parsed = projectStatusSchema.safeParse({
      projectId: PROJECT_ID,
      status: "blocked",
      blockedReason: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.success === false && parsed.error.issues[0]?.path).toEqual([
      "blockedReason",
    ]);
  });

  it("accepts a blocker that has a reason", () => {
    const parsed = projectStatusSchema.safeParse({
      projectId: PROJECT_ID,
      status: "blocked",
      blockedReason: "  Waiting on the surveyor  ",
    });

    expect(parsed.success && parsed.data.blockedReason).toBe(
      "Waiting on the surveyor",
    );
  });

  it("discards a reason when the status is not blocked", () => {
    // Otherwise a solved blocker survives being unblocked and is shown later as
    // though it still applied.
    const parsed = projectStatusSchema.safeParse({
      projectId: PROJECT_ID,
      status: "active",
      blockedReason: "Waiting on the surveyor",
    });

    expect(parsed.success && parsed.data.blockedReason).toBeNull();
  });

  it("rejects a status the database would not accept", () => {
    expect(
      projectStatusSchema.safeParse({
        projectId: PROJECT_ID,
        status: "on_fire",
        blockedReason: "",
      }).success,
    ).toBe(false);
  });
});

describe("the status vocabulary", () => {
  it("gives every status a label and a plain-language meaning", () => {
    for (const status of PROJECT_STATUSES) {
      expect(describeProjectStatus(status)).not.toBe(status);
      expect(STATUS_MEANINGS[status].length).toBeGreaterThan(0);
    }
  });

  it("shows an unrecognised status as itself instead of hiding the row", () => {
    expect(isProjectStatus("archived")).toBe(false);
    expect(describeProjectStatus("archived")).toBe("archived");
  });

  it("treats active, blocked and paused as still open", () => {
    expect(["active", "blocked", "paused"].every(isOpenStatus)).toBe(true);
    expect(["done", "abandoned"].some(isOpenStatus)).toBe(false);
  });
});
