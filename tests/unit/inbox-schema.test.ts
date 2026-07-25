import { describe, expect, it } from "vitest";
import {
  captureSchema,
  describeKind,
  describeProcessedInto,
  INBOX_KINDS,
  PROCESS_ROUTES,
  PROCESS_ROUTE_LABELS,
  processInboxItemSchema,
  processedIntoFor,
  suggestProjectName,
} from "@/lib/schemas/inbox";

const ITEM_ID = "22222222-2222-4222-8222-222222222222";
const PROJECT_ID = "33333333-3333-4333-8333-333333333333";

describe("capturing", () => {
  it("accepts anything that is not empty", () => {
    const parsed = captureSchema.safeParse({ content: "  party wall?  " });
    expect(parsed.success && parsed.data.content).toBe("party wall?");
  });

  it("refuses an empty capture, which would be a record of nothing", () => {
    expect(captureSchema.safeParse({ content: "   " }).success).toBe(false);
  });

  it("asks for no metadata at all", () => {
    // The whole value of an inbox is that using it requires no decisions. If a
    // second required field ever appears here, this test should fail loudly.
    const parsed = captureSchema.parse({ content: "a thought" });
    expect(Object.keys(parsed)).toEqual(["content"]);
  });

  it("caps a capture at the column length", () => {
    expect(captureSchema.safeParse({ content: "x".repeat(4001) }).success).toBe(false);
    expect(captureSchema.safeParse({ content: "x".repeat(4000) }).success).toBe(true);
  });
});

describe("processing routes", () => {
  it("requires a project name when starting a project", () => {
    expect(
      processInboxItemSchema.safeParse({
        route: "start_project",
        itemId: ITEM_ID,
        kind: "",
        projectName: "",
      }).success,
    ).toBe(false);
  });

  it("requires a project when promoting to a next action", () => {
    expect(
      processInboxItemSchema.safeParse({
        route: "next_action",
        itemId: ITEM_ID,
        kind: "",
        projectId: "",
        nextAction: "Call the surveyor",
      }).success,
    ).toBe(false);
  });

  it("requires the next action itself, not merely a project", () => {
    expect(
      processInboxItemSchema.safeParse({
        route: "next_action",
        itemId: ITEM_ID,
        kind: "",
        projectId: PROJECT_ID,
        nextAction: "   ",
      }).success,
    ).toBe(false);
  });

  it("accepts archiving with nothing else supplied", () => {
    const parsed = processInboxItemSchema.safeParse({
      route: "archive",
      itemId: ITEM_ID,
      kind: "",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a route that does not exist", () => {
    expect(
      processInboxItemSchema.safeParse({
        route: "delete_forever",
        itemId: ITEM_ID,
        kind: "",
      }).success,
    ).toBe(false);
  });

  it("maps every route to a value the database will accept", () => {
    expect(PROCESS_ROUTES.map(processedIntoFor)).toEqual([
      "project",
      "project_next_action",
      "project_material",
      "archived",
    ]);
  });

  it("labels every route", () => {
    for (const route of PROCESS_ROUTES) {
      expect(PROCESS_ROUTE_LABELS[route].length).toBeGreaterThan(0);
    }
  });
});

describe("classification", () => {
  it("treats a blank choice as unclassified rather than as a kind", () => {
    const parsed = processInboxItemSchema.safeParse({
      route: "archive",
      itemId: ITEM_ID,
      kind: "",
    });
    expect(parsed.success && parsed.data.kind).toBeNull();
  });

  it("defaults to unclassified when no choice is offered at all", () => {
    const parsed = processInboxItemSchema.safeParse({
      route: "archive",
      itemId: ITEM_ID,
    });
    expect(parsed.success && parsed.data.kind).toBeNull();
  });

  it("rejects a kind the database would not accept", () => {
    expect(
      processInboxItemSchema.safeParse({
        route: "archive",
        itemId: ITEM_ID,
        kind: "reminder",
      }).success,
    ).toBe(false);
  });

  it("says nothing at all about an unclassified capture", () => {
    expect(describeKind(null)).toBeNull();
  });

  it("labels every kind it accepts, and shows an unknown one as itself", () => {
    for (const kind of INBOX_KINDS) {
      expect(describeKind(kind)).toBeTruthy();
    }
    expect(describeKind("reminder")).toBe("reminder");
  });

  it("says what a processed capture became", () => {
    expect(describeProcessedInto("project_next_action")).toBe("Became a next action");
    expect(describeProcessedInto(null)).toBeNull();
    expect(describeProcessedInto("something_else")).toBe("something_else");
  });
});

describe("suggesting a project name", () => {
  it("offers the first line of the capture", () => {
    expect(suggestProjectName("Loft conversion\nask about the party wall")).toBe(
      "Loft conversion",
    );
  });

  it("shortens a long line visibly rather than silently", () => {
    const suggested = suggestProjectName("x".repeat(300));
    expect(suggested).toHaveLength(120);
    expect(suggested.endsWith("…")).toBe(true);
  });
});
