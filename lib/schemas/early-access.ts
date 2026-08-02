import { z } from "zod";

/**
 * The early-access request, as the server understands it.
 *
 * This module is the single definition of what a request may contain. The
 * cards on the page, the client-side validation, the server action and the
 * CHECK constraints in `supabase/migrations/0003_early_access.sql` all express
 * the same closed sets, and `tests/unit/early-access-schema.test.ts` reads the
 * migration to prove the two have not drifted apart.
 *
 * Three answers are required and four are not. The optional ones exist because
 * they help the owner prioritise, not because a submission is incomplete
 * without them — a form that demands your team size before it will hear from
 * you is a form about the company, not the visitor.
 */

export const USE_CASES = [
  "personal_productivity",
  "software_development",
  "ai_agents",
  "knowledge_management",
  "business_operations",
  "finance",
  "research",
  "other",
] as const;

export type UseCase = (typeof USE_CASES)[number];

export interface UseCaseOption {
  value: UseCase;
  label: string;
  /** One line describing the work, never the product's opinion of it. */
  description: string;
}

export const USE_CASE_OPTIONS: readonly UseCaseOption[] = [
  {
    value: "personal_productivity",
    label: "Personal productivity",
    description: "Keeping your own commitments, projects and follow-ups in one place.",
  },
  {
    value: "software_development",
    label: "Software development",
    description: "Carrying architecture, decisions and context between coding sessions.",
  },
  {
    value: "ai_agents",
    label: "AI agents",
    description: "Coordinating agents that share context and act under permission.",
  },
  {
    value: "knowledge_management",
    label: "Knowledge management",
    description: "Turning notes, research and documents into knowledge you can retrieve.",
  },
  {
    value: "business_operations",
    label: "Business operations",
    description: "Tracking work, owners and status across a team or an organisation.",
  },
  {
    value: "finance",
    label: "Finance",
    description: "Following positions, obligations and decisions alongside their reasoning.",
  },
  {
    value: "research",
    label: "Research",
    description: "Holding a long investigation together across sources and sessions.",
  },
  {
    value: "other",
    label: "Something else",
    description: "Describe it in your own words.",
  },
];

export const TEAM_SIZES = ["just_me", "2_10", "11_50", "50_plus"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export const TEAM_SIZE_OPTIONS: readonly { value: TeamSize; label: string }[] = [
  { value: "just_me", label: "Just me" },
  { value: "2_10", label: "2–10" },
  { value: "11_50", label: "11–50" },
  { value: "50_plus", label: "50+" },
];

/** Mirrors the length bounds in the migration, so the two cannot disagree. */
export const LIMITS = {
  name: 120,
  email: 254,
  company: 120,
  otherUseCase: 2000,
  challenge: 2000,
} as const;

/**
 * Control characters that no answer contains and PostgreSQL will not store.
 *
 * A NUL byte is the one that matters: `text` cannot hold it, so a submission
 * carrying one used to reach the database and abort the whole call — including
 * the rate-limit counter spent on it, which made such a request free and
 * unmetered. The database now records the count regardless
 * (`supabase/migrations/0005_intake_meter_is_atomic.sql`), and this refuses the
 * input at the boundary so the situation does not arise. Tab, newline and
 * carriage return are allowed: the two long answers are textareas.
 */
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const noControlCharacters = <T extends z.ZodType<string | undefined>>(schema: T) =>
  schema.refine(
    (value) => value === undefined || !CONTROL_CHARACTERS.test(value),
    "Remove any special characters and try again.",
  );

/**
 * Every unfilled input in a `FormData` arrives as an empty string, so each
 * optional field collapses "" to undefined before anything else looks at it.
 * Without that, "optional" would quietly mean "optional unless you focused it".
 */
const optionalText = (max: number, tooLong: string) =>
  noControlCharacters(
    z
      .string()
      .trim()
      .max(max, tooLong)
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  );

/** The one value that means "this group has not been answered yet". */
const UNANSWERED = "";

/**
 * A closed set of choices, plus the several ways of not having chosen.
 *
 * A radio group with nothing checked reaches this schema as three different
 * values depending on who is asking: `FormData` omits the field entirely, React
 * Hook Form reports the group as `null`, and a form repopulated after a server
 * rejection holds an empty string. All three mean the same thing, so they are
 * normalised to one before the closed set is consulted.
 *
 * Without that, not having answered yet fails the enum and the visitor is shown
 * `Invalid option; expected one of "just_me"|…` — Zod explaining itself to a
 * developer, on a page that is talking to a stranger.
 */
const choiceOf = <const T extends readonly [string, ...string[]]>(options: T) =>
  z
    .union([z.enum(options), z.literal(UNANSWERED), z.null(), z.undefined()])
    .transform((value) => value ?? UNANSWERED);

/**
 * One schema for the page and the server.
 *
 * The unselected states — an empty use case, an empty team size — are part of
 * the accepted *input* rather than a failed match, so the visitor is told
 * "Choose how you plan to use ASI.OS" instead of meeting a union error. What
 * comes out the other side is narrowed: `useCase` is always a real choice, and
 * `otherUseCase` survives only alongside the category it describes.
 */
export const earlyAccessRequestSchema = z
  .object({
    name: noControlCharacters(
      z
        .string()
        .trim()
        .min(1, "Tell us your name.")
        .max(LIMITS.name, `Keep your name to ${LIMITS.name} characters or fewer.`),
    ),
    email: z
      .string()
      .trim()
      .min(1, "We need an email address to reply to.")
      .max(LIMITS.email, "That email address is too long.")
      .pipe(z.email("That does not look like an email address."))
      .transform((value) => value.toLowerCase()),
    company: optionalText(
      LIMITS.company,
      `Keep the company name to ${LIMITS.company} characters or fewer.`,
    ),
    useCase: choiceOf(USE_CASES),
    otherUseCase: optionalText(
      LIMITS.otherUseCase,
      `Keep this to ${LIMITS.otherUseCase} characters or fewer.`,
    ),
    teamSize: choiceOf(TEAM_SIZES).transform((value) =>
      value === UNANSWERED ? undefined : value,
    ),
    challenge: optionalText(
      LIMITS.challenge,
      `Keep this to ${LIMITS.challenge} characters or fewer.`,
    ),
  })
  .superRefine((values, ctx) => {
    if (values.useCase === UNANSWERED) {
      ctx.addIssue({
        code: "custom",
        path: ["useCase"],
        message: "Choose how you plan to use ASI.OS.",
      });
      return;
    }

    if (values.useCase === "other" && !values.otherUseCase) {
      ctx.addIssue({
        code: "custom",
        path: ["otherUseCase"],
        message: "Tell us what you would use ASI.OS for.",
      });
    }
  })
  .transform((values) => ({
    ...values,
    // The empty case added an issue above, so parsing already failed and this
    // transform never runs with it.
    useCase: values.useCase as UseCase,
    otherUseCase: values.useCase === "other" ? values.otherUseCase : undefined,
  }));

/** What the form holds while it is being filled in: every field a string. */
export type EarlyAccessFormValues = z.input<typeof earlyAccessRequestSchema>;

/**
 * What a choice looks like mid-form, unanswered states included. Derived from
 * the schema so the cards and the radios cannot claim to render a value the
 * form is incapable of holding.
 */
export type UseCaseAnswer = EarlyAccessFormValues["useCase"];
export type TeamSizeAnswer = EarlyAccessFormValues["teamSize"];

/** What the server acts on: narrowed, trimmed, and lower-cased. */
export type EarlyAccessRequest = z.output<typeof earlyAccessRequestSchema>;

export const EMPTY_FORM_VALUES: EarlyAccessFormValues = {
  name: "",
  email: "",
  company: "",
  useCase: "",
  otherUseCase: "",
  teamSize: "",
  challenge: "",
};

/** The field names, in the order they appear, so focus after a failure follows the page. */
export const FIELD_ORDER = [
  "name",
  "email",
  "company",
  "useCase",
  "otherUseCase",
  "teamSize",
  "challenge",
] as const;

export type EarlyAccessField = (typeof FIELD_ORDER)[number];

/**
 * Reads a submission out of a `FormData`.
 *
 * Kept beside the schema and pure, so the server action stays a thin boundary
 * and this is testable without a request. A value that is not a string — a
 * file part, a missing key — becomes an empty string rather than throwing, and
 * is then rejected by the schema like any other empty field.
 */
export function readEarlyAccessForm(formData: FormData): Record<EarlyAccessField, string> {
  const field = (key: EarlyAccessField): string => {
    const value = formData.get(key);
    return typeof value === "string" ? value : "";
  };

  return {
    name: field("name"),
    email: field("email"),
    company: field("company"),
    useCase: field("useCase"),
    otherUseCase: field("otherUseCase"),
    teamSize: field("teamSize"),
    challenge: field("challenge"),
  };
}

/**
 * Turns a rejected submission back into something the form can be refilled
 * with.
 *
 * Only needed without JavaScript, where a rejection is a fresh page and every
 * uncontrolled input would otherwise come back empty — which turns one wrong
 * character into typing the whole form again. Unrecognised choices become the
 * unselected state rather than being echoed back as a value nothing can
 * render.
 */
export function coerceFormValues(
  raw: Record<EarlyAccessField, string>,
): EarlyAccessFormValues {
  const oneOf = <T extends string>(options: readonly T[], value: string): T | "" =>
    (options as readonly string[]).includes(value) ? (value as T) : "";

  return {
    name: raw.name,
    email: raw.email,
    company: raw.company,
    useCase: oneOf(USE_CASES, raw.useCase),
    otherUseCase: raw.otherUseCase,
    teamSize: oneOf(TEAM_SIZES, raw.teamSize),
    challenge: raw.challenge,
  };
}
