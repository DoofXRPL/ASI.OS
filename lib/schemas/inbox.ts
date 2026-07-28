import { z } from "zod";

/**
 * Capture, and what may happen to a capture afterwards.
 *
 * The rule this file exists to hold: capture costs nothing and changes nothing.
 * One field, no required metadata, no decision about where the thought belongs.
 * Everything else — what kind of thing it is, which project it serves — is
 * decided later and never rewrites what was written.
 */
export const INBOX_KINDS = ["note", "task", "idea", "question", "link"] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

const KIND_LABELS: Record<InboxKind, string> = {
  note: "Note",
  task: "Task",
  idea: "Idea",
  question: "Question",
  link: "Link",
};

export function isInboxKind(value: string): value is InboxKind {
  return (INBOX_KINDS as readonly string[]).includes(value);
}

/**
 * An unclassified capture says so rather than being labelled by ASI. An
 * unrecognised value is shown as-is, on the same principle as the audit trail:
 * the record matters more than the interface's vocabulary.
 */
export function describeKind(value: string | null): string | null {
  if (value === null) return null;
  return isInboxKind(value) ? KIND_LABELS[value] : value;
}

export const INBOX_STATUSES = ["unprocessed", "processed", "archived"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

/**
 * What a capture became. Stored so the queue can never say "processed" without
 * being able to say into what.
 */
export const PROCESSED_INTO = [
  "project",
  "project_next_action",
  "project_material",
  "archived",
] as const;
export type ProcessedInto = (typeof PROCESSED_INTO)[number];

const PROCESSED_INTO_LABELS: Record<ProcessedInto, string> = {
  project: "Became a project",
  project_next_action: "Became a next action",
  project_material: "Attached to a project",
  archived: "Archived",
};

export function describeProcessedInto(value: string | null): string | null {
  if (value === null) return null;
  return (PROCESSED_INTO_LABELS as Record<string, string>)[value] ?? value;
}

/**
 * The longest a single capture may be.
 *
 * Exported so the field, the counter and the server all read one number. Three
 * copies of 4000 is three chances for the interface to promise a limit the
 * server does not keep.
 */
export const CAPTURE_MAX_CHARACTERS = 4000;

export const captureSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Write something to capture.")
    .max(
      CAPTURE_MAX_CHARACTERS,
      `Keep a capture to ${CAPTURE_MAX_CHARACTERS} characters or fewer.`,
    ),
});

export type Capture = z.infer<typeof captureSchema>;

/**
 * How close a capture is to the limit, once that is worth saying.
 *
 * A counter that appears at the first keystroke turns a field with no decisions
 * in it into a field with a budget. It stays absent until the limit is close
 * enough to matter, and `null` means there is nothing to report.
 */
export const CAPTURE_COUNTER_APPEARS_WITHIN = 200;

export function captureCharactersLeft(length: number): number | null {
  const remaining = CAPTURE_MAX_CHARACTERS - length;
  return remaining <= CAPTURE_COUNTER_APPEARS_WITHIN ? remaining : null;
}

/**
 * The four routes out of the inbox.
 *
 * A discriminated union rather than a bag of optional fields, so "attach to a
 * project" cannot be submitted without a project, and the server never has to
 * guess what was intended.
 */
export const PROCESS_ROUTES = [
  "start_project",
  "next_action",
  "attach",
  "archive",
] as const;
export type ProcessRoute = (typeof PROCESS_ROUTES)[number];

export const PROCESS_ROUTE_LABELS: Record<ProcessRoute, string> = {
  start_project: "Start a project from this",
  next_action: "Make this a project's next action",
  attach: "Attach to a project as context",
  archive: "Archive it",
};

const itemId = z.uuid("That capture reference is not valid.");
const projectId = z.uuid("Choose a project.");

const kind = z
  .union([z.enum(INBOX_KINDS), z.literal("")])
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null);

export const processInboxItemSchema = z.discriminatedUnion("route", [
  z.object({
    route: z.literal("start_project"),
    itemId,
    kind,
    projectName: z
      .string()
      .trim()
      .min(1, "Give the project a name.")
      .max(120, "Keep the name to 120 characters or fewer."),
  }),
  z.object({
    route: z.literal("next_action"),
    itemId,
    kind,
    projectId,
    /**
     * Offered prefilled with the captured text and editable, because a next
     * action has to fit on one line and a capture does not. Truncating someone's
     * own words on their behalf would be the system deciding which part of the
     * thought mattered.
     */
    nextAction: z
      .string()
      .trim()
      .min(1, "Say what the next action is.")
      .max(280, "Keep the next action to 280 characters or fewer."),
  }),
  z.object({
    route: z.literal("attach"),
    itemId,
    kind,
    projectId,
  }),
  z.object({
    route: z.literal("archive"),
    itemId,
    kind,
  }),
]);

export type ProcessInboxItem = z.infer<typeof processInboxItemSchema>;

/** The route a capture took, expressed as the value stored on the row. */
export function processedIntoFor(route: ProcessRoute): ProcessedInto {
  switch (route) {
    case "start_project":
      return "project";
    case "next_action":
      return "project_next_action";
    case "attach":
      return "project_material";
    case "archive":
      return "archived";
  }
}

/**
 * A project name suggested from captured text. Offered as an editable default
 * in the form and never applied silently: the value the user submits is the
 * value that is stored.
 */
export function suggestProjectName(content: string): string {
  const firstLine = content.trim().split("\n")[0]?.trim() ?? "";
  if (firstLine.length <= 120) return firstLine;
  return `${firstLine.slice(0, 119).trimEnd()}…`;
}
