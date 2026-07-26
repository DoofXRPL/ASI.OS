import { z } from "zod";

/**
 * The vocabulary of a project, and the rules for changing one.
 *
 * A project exists to answer one question — what moves this forward? — so the
 * schemas here are built around `next_action` and around refusing to record a
 * blocker without a reason.
 */
export const PROJECT_STATUSES = [
  "active",
  "paused",
  "blocked",
  "done",
  "abandoned",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: "Active",
  paused: "Paused",
  blocked: "Blocked",
  done: "Done",
  abandoned: "Abandoned",
};

/**
 * What each status means, shown next to the control that sets it. A status the
 * reader has to guess at is a status they will set wrongly.
 */
export const STATUS_MEANINGS: Record<ProjectStatus, string> = {
  active: "You intend to move this forward.",
  paused: "Deliberately set down, to return to later.",
  blocked: "Something outside this project is in the way.",
  done: "The outcome happened.",
  abandoned: "You decided not to pursue it.",
};

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

/** Unknown values are shown as-is rather than hidden or guessed at. */
export function describeProjectStatus(value: string): string {
  return isProjectStatus(value) ? STATUS_LABELS[value] : value;
}

/** Statuses that still represent work you intend to do. */
export function isOpenStatus(value: string): boolean {
  return value === "active" || value === "blocked" || value === "paused";
}

/**
 * Blank input clears the field rather than storing an empty string, so "no next
 * action" has exactly one representation in the database. The same rule is
 * enforced by a CHECK constraint, because the form is a convenience and the
 * database is the last word.
 */
function optionalText(max: number, tooLong: string) {
  return z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();
}

const projectId = z.uuid("That project reference is not valid.");

export const projectCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the project a name.")
    .max(120, "Keep the name to 120 characters or fewer."),
  outcome: optionalText(2000, "Keep the outcome to 2000 characters or fewer."),
});

export type ProjectCreate = z.infer<typeof projectCreateSchema>;

export const nextActionSchema = z.object({
  projectId,
  nextAction: optionalText(280, "Keep the next action to 280 characters or fewer."),
});

export type NextActionUpdate = z.infer<typeof nextActionSchema>;

export const projectOutcomeSchema = z.object({
  projectId,
  outcome: optionalText(2000, "Keep the outcome to 2000 characters or fewer."),
});

export type ProjectOutcomeUpdate = z.infer<typeof projectOutcomeSchema>;

/**
 * Changing status.
 *
 * Blocking requires a reason and every other status discards one, so a stale
 * blocker can never survive being unblocked and be rendered later as if it were
 * still true. The database enforces the same biconditional.
 */
export const projectStatusSchema = z
  .object({
    projectId,
    status: z.enum(PROJECT_STATUSES, {
      message: "That is not a status a project can have.",
    }),
    blockedReason: optionalText(500, "Keep the reason to 500 characters or fewer."),
  })
  .transform((value) =>
    value.status === "blocked"
      ? value
      : { ...value, blockedReason: null as string | null },
  )
  .refine((value) => value.status !== "blocked" || value.blockedReason !== null, {
    message: "Say what is blocking this. A blocker nobody can read is not one.",
    path: ["blockedReason"],
  });

export type ProjectStatusUpdate = z.infer<typeof projectStatusSchema>;
