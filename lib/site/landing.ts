import type { AttentionReason } from "@/lib/derive/attention";
import { ATTENTION_REASONS } from "@/lib/derive/attention";
import { STALE_AFTER_DAYS } from "@/lib/derive/today";

/**
 * What the front page is allowed to say.
 *
 * A landing page is the one surface in this product with no rows behind it, which
 * makes it the easiest place to start fabricating. So the claims live here, as
 * data, next to the code that can contradict them:
 *
 * - the working surfaces are derived from the navigation spine, so the page
 *   cannot advertise a route that does not exist;
 * - anything named as not built is dropped the moment it enters that spine;
 * - the attention rules are keyed by `AttentionReason`, so adding a rule to
 *   `lib/derive/attention.ts` fails typecheck until this page describes it.
 *
 * The tone rule that goes with it: describe the loop as a design, and the build as
 * it is. Never let the second borrow the tense of the first.
 */

/** A shape `NavItem` satisfies, so `lib/` needs no import from `components/`. */
export interface SurfaceLike {
  href: string;
  label: string;
  purpose: string;
}

export interface AbsentSurface {
  label: string;
  /** Where it sits in docs/IMPLEMENTATION_PLAN.md. */
  phase: string;
  /** Said plainly, in the present tense, with no promise attached. */
  detail: string;
}

export interface LandingLedger {
  working: SurfaceLike[];
  absent: AbsentSurface[];
}

/**
 * Named because they are missing, not because they are coming.
 *
 * Each entry disappears from the page automatically once the surface earns a
 * place in the navigation — see docs/DECISIONS/0002-navigation-earns-its-place.md.
 */
const NOT_BUILT: AbsentSurface[] = [
  {
    label: "Decisions",
    phase: "Phase 2",
    detail:
      "Approving, modifying, snoozing and declining a recommendation. There are no recommendations to decide on yet.",
  },
  {
    label: "Memory",
    phase: "Phase 3",
    detail:
      "Confirmed facts with a source, a correction history and a way to forget them. Nothing is remembered about you today beyond the rows you wrote.",
  },
  {
    label: "Connections",
    phase: "Phase 5",
    detail:
      "External tools with explicit read and write scopes. ASI OS makes no network call to anything but its own database.",
  },
];

export function landingLedger(surfaces: SurfaceLike[]): LandingLedger {
  const shipped = new Set(surfaces.map((surface) => surface.label.toLowerCase()));

  return {
    working: surfaces.map(({ href, label, purpose }) => ({ href, label, purpose })),
    absent: NOT_BUILT.filter((item) => !shipped.has(item.label.toLowerCase())),
  };
}

/** Whether a stage of the loop runs today, and what runs it. */
export type StageStatus = "running" | "designed";

export interface LoopStageCopy {
  stage: string;
  status: StageStatus;
  claim: string;
  detail: string;
}

/**
 * The loop is the product, so it is the first thing the page explains — with each
 * stage marked for what it actually is right now. Three of the six run on
 * deterministic code and no model. The other three are designed and not built,
 * which the page says in those words.
 */
export const LOOP_COPY: LoopStageCopy[] = [
  {
    stage: "Observe",
    status: "running",
    claim: "Capture in one field, decide later.",
    detail:
      "What you wrote is stored exactly as you wrote it and cannot be edited afterwards — not by you, and not by the system.",
  },
  {
    stage: "Understand",
    status: "running",
    claim: "A project states the outcome you want.",
    detail:
      "An outcome, a status, one next action, and a written reason whenever it is blocked. A blocked project without a reason is not accepted.",
  },
  {
    stage: "Recommend",
    status: "running",
    claim: "Today ranks what needs you, from your own rows.",
    detail:
      "Four rules over real records, in a fixed order. No model, no score, and no invented deadline.",
  },
  {
    stage: "Approve",
    status: "designed",
    claim: "Nothing consequential happens without you.",
    detail:
      "Approve, modify, snooze, or decline with a reason. The server decides what needs approval, so nothing can talk its way past the gate.",
  },
  {
    stage: "Act",
    status: "designed",
    claim: "Reversible internal changes only.",
    detail:
      "Every action comes from a server-side registry that declares whether it can be undone. No external side effects.",
  },
  {
    stage: "Remember",
    status: "running",
    claim: "An append-only record of what changed.",
    detail:
      "The trail records the change, not the save. Where nothing changed, nothing is written, so it never becomes a log of who clicked.",
  },
];

const COUNT_WORDS = [
  "None",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
] as const;

function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count);
}

/**
 * The sentence the hero prints about its own build, counted from the stages
 * rather than typed into the page.
 *
 * This is the claim most likely to rot: the day a stage starts running, prose
 * saying "three of six" becomes a lie that nothing else in the codebase would
 * notice. Generating it means the hero cannot be wrong about the loop unless the
 * loop is wrong about itself.
 */
export function loopStatusSentence(stages: LoopStageCopy[] = LOOP_COPY): string {
  const running = stages.filter((stage) => stage.status === "running").length;
  const designed = stages.length - running;

  const built = `${countWord(running)} of those ${countWord(stages.length).toLowerCase()} stages run today, on deterministic code and no model.`;

  if (designed === 0) return `${built} The loop is closed.`;

  const rest =
    designed === 1
      ? "The remaining one is designed and not built"
      : `The other ${countWord(designed).toLowerCase()} are designed and not built`;

  return `${built} ${rest}, and this page says which.`;
}

export interface PrincipleCopy {
  title: string;
  body: string;
  /** Where the claim is enforced, so it can be checked rather than believed. */
  enforcedBy: string;
}

/** Six of the eleven review criteria in docs/PRINCIPLES.md, in their own words. */
export const PRINCIPLE_COPY: PrincipleCopy[] = [
  {
    title: "Isolation is the database's job",
    body: "The application holds no privileged credential. Reading another account's rows is not a bug to avoid here — it is a capability the code does not have.",
    enforcedBy: "Row Level Security · npm run guard:service-role",
  },
  {
    title: "Never fabricate",
    body: "No placeholder number, no sample row, no metric that was not read from a record. There is deliberately no component for a value that is not real.",
    enforcedBy: "components/os/states.tsx",
  },
  {
    title: "Wired or absent",
    body: "A control that looks real and changes nothing is a trust bug, and a worse one than a missing feature: it teaches you that the interface lies.",
    enforcedBy: "Review criterion 3",
  },
  {
    title: "A read that fails says so",
    body: "A broken query renders as broken. Returning an empty list instead would make a failing database look like an empty account, which is the more damaging of the two.",
    enforcedBy: "ReadResult<T> in lib/db/result.ts",
  },
  {
    title: "Derived output names its evidence",
    body: "Everything Today asserts comes from a pure function and carries the id of the row it was given. The word urgent appears nowhere, because nobody made that commitment.",
    enforcedBy: "lib/derive/ · unit tests, no database",
  },
  {
    title: "Navigation earns its place",
    body: "A surface enters the menu in the release that makes it work. Nothing is badged soon, and a route that does not exist returns a real 404.",
    enforcedBy: "ADR 0002",
  },
];

/**
 * The four rules Today uses, keyed by the reason codes the derivation actually
 * emits. Exhaustive by type: a new rule cannot ship while this page still claims
 * there are four.
 */
const ATTENTION_COPY: Record<AttentionReason, string> = {
  blocked: "A project you marked blocked, quoting the reason you wrote.",
  no_next_action: "An active project with no next action written down.",
  unprocessed_captures: "Captures waiting, counted, with the age of the oldest.",
  stale: `An active project untouched for ${STALE_AFTER_DAYS} days. Elapsed time is a fact; lateness would be a judgement.`,
};

export const ATTENTION_RULES: { reason: AttentionReason; detail: string }[] =
  ATTENTION_REASONS.map((reason) => ({ reason, detail: ATTENTION_COPY[reason] }));

export interface StackEntry {
  name: string;
  /** Why this one, in a clause. Never a version number that will go stale. */
  role: string;
}

/** Everything in package.json that a reader would want named, and nothing else. */
export const STACK: StackEntry[] = [
  { name: "Next.js App Router", role: "every private surface rendered per request" },
  { name: "TypeScript, strict", role: "type errors fail the build" },
  { name: "Supabase Postgres", role: "the only store, reached as the caller" },
  { name: "Row Level Security", role: "the isolation boundary, proven by tests" },
  { name: "Zod", role: "validation at the server boundary, not in the form" },
  { name: "Tailwind v4 tokens", role: "colour that carries meaning" },
  { name: "Vitest", role: "pure derivations tested without a database" },
  { name: "No AI layer yet", role: "and no external network call of any kind" },
];
