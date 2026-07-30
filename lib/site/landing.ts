/**
 * What the front page is allowed to say.
 *
 * A landing page is the one surface in this product with no rows behind it,
 * which makes it the easiest place to start fabricating. So the claims live
 * here, as data, next to the code that can contradict them:
 *
 * - every capability, layer and phase carries a `Status`, and the copy may
 *   never present anything beyond `running` as if it works today;
 * - the working surfaces are derived from the navigation spine, so the page
 *   cannot advertise a route that does not exist;
 * - interface mock-ups are permitted only as visibly labelled design targets —
 *   a specification is honest where a fake screenshot is not (ADR 0007);
 * - `tests/unit/landing.test.ts` scans all of this for the marketing words the
 *   product has banned for itself.
 *
 * Tone rule: describe the design in the future it belongs to, and the build in
 * the present it actually has. Never let one borrow the other's tense.
 */

/** The honesty vocabulary. Everything the page claims carries one of these. */
export type Status = "running" | "in_development" | "planned" | "proposed";

export const STATUS_LABEL: Record<Status, string> = {
  running: "Running",
  in_development: "In development",
  planned: "Planned",
  proposed: "Proposed",
};

/* ------------------------------------------------------------------ */
/* The ledger: what exists, derived from the navigation spine.         */
/* ------------------------------------------------------------------ */

/** A shape `NavItem` satisfies, so `lib/` needs no import from `components/`. */
export interface SurfaceLike {
  href: string;
  label: string;
  purpose: string;
}

export interface AbsentSurface {
  label: string;
  /** Where it sits in the public roadmap. */
  phase: string;
  /** Said plainly, in the present tense, with no promise attached. */
  detail: string;
}

export interface LandingLedger {
  working: SurfaceLike[];
  absent: AbsentSurface[];
}

/**
 * Named because they are missing, not because they are coming. Each entry
 * disappears automatically once the surface earns a place in the navigation —
 * see docs/DECISIONS/0002-navigation-earns-its-place.md.
 */
const NOT_BUILT: AbsentSurface[] = [
  {
    label: "Decisions",
    phase: "Phase 02",
    detail:
      "Approving, editing, or rejecting a recommendation. There are no recommendations to decide on yet.",
  },
  {
    label: "Memory",
    phase: "Phase 03",
    detail:
      "Confirmed facts with a source, a correction history and a way to forget them. Nothing is remembered about you today beyond the rows you wrote.",
  },
  {
    label: "Connections",
    phase: "Phase 04",
    detail:
      "External tools with explicit read and write scopes. ASI.OS makes no network call to anything but its own database.",
  },
];

export function landingLedger(surfaces: SurfaceLike[]): LandingLedger {
  const shipped = new Set(surfaces.map((surface) => surface.label.toLowerCase()));

  return {
    working: surfaces.map(({ href, label, purpose }) => ({ href, label, purpose })),
    absent: NOT_BUILT.filter((item) => !shipped.has(item.label.toLowerCase())),
  };
}

/* ------------------------------------------------------------------ */
/* Hero and system status panel.                                       */
/* ------------------------------------------------------------------ */

export const HERO = {
  statusNote: "Foundation phase",
  headline: "Intelligence that remembers where you are going.",
  support:
    "ASI.OS is a personal intelligence operating system being built to connect persistent memory, specialized agents, tools, and long-term context inside one human-controlled system.",
  clarifier: "It does not replace your judgment. It is being built to strengthen it.",
} as const;

export interface StatusRow {
  label: string;
  value: string;
  status?: Status;
}

/**
 * The panel beside the hero states facts about the system as it is, not as it
 * is imagined. Every row here must stay true against the repository.
 */
export const STATUS_PANEL: StatusRow[] = [
  { label: "System status", value: "Foundation phase", status: "running" },
  { label: "Operating model", value: "Human-guided" },
  { label: "Agent authority", value: "Advisory — permission-based" },
  { label: "Memory architecture", value: "Obsidian Brain", status: "planned" },
  { label: "AI layer", value: "Not yet built" },
  { label: "External network calls", value: "None" },
  { label: "Account isolation", value: "Enforced by the database", status: "running" },
];

/* ------------------------------------------------------------------ */
/* Problem: fragmentation.                                             */
/* ------------------------------------------------------------------ */

export const PROBLEM = {
  headline: "Powerful tools. Fragmented context.",
  body: [
    "Modern tooling is capable but disconnected. Conversations live in one platform, documents in another; tasks, research, code, decisions and project history are spread across dozens of systems.",
    "Every new session starts with missing context. The deeper problem is not a lack of intelligence — it is a lack of continuity.",
  ],
  inputs: [
    "Conversations",
    "Documents",
    "Tasks",
    "Repositories",
    "Decisions",
    "Project history",
  ],
  outcome: "One connected context layer",
} as const;

/* ------------------------------------------------------------------ */
/* Command Center preview — a labelled design target, not a screenshot. */
/* ------------------------------------------------------------------ */

export const PREVIEW = {
  title: "Command Center",
  status: "planned" as Status,
  phase: "Design target — Phase 02",
  caption:
    "A design specification for the Phase 02 Command Center. No live system renders this panel yet — the surfaces that do run are listed under Status below.",
  request: "Review the current ASI.OS architecture and identify what should be built next.",
  steps: [
    "Intent understood",
    "Project context retrieved",
    "Relevant memories selected",
    "Architecture agent assigned",
    "Security agent assigned",
    "Recommendation prepared",
    "Execution awaiting approval",
  ],
  meta: [
    { label: "Context sources", value: "project row · linked memories" },
    { label: "Agents", value: "architecture · security" },
    { label: "Authority", value: "advisory" },
    { label: "Confidence", value: "low | medium | high — stated, never scored" },
    { label: "Reversibility", value: "required before execution" },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Architecture layers.                                                */
/* ------------------------------------------------------------------ */

export interface ArchitectureLayer {
  index: string;
  name: string;
  body: string;
  status: Status;
  /** What makes the status claim true right now. */
  note: string;
}

export const ARCHITECTURE_LAYERS: ArchitectureLayer[] = [
  {
    index: "01",
    name: "Interface",
    body: "One command center across the surfaces where work actually happens.",
    status: "in_development",
    note: "Five surfaces run today: capture, projects, a derived Today, an activity trail, settings.",
  },
  {
    index: "02",
    name: "Context",
    body: "Identifies the active project, the current objective, and the history that matters before anything responds.",
    status: "planned",
    note: "Today's view is already derived from real rows; retrieval beyond that is not built.",
  },
  {
    index: "03",
    name: "Memory",
    body: "Obsidian Brain retrieves the most relevant confirmed knowledge — decisions, failures, direction.",
    status: "planned",
    note: "The memory model is specified; no memory table exists yet.",
  },
  {
    index: "04",
    name: "Orchestration",
    body: "Selects agents, models, tools and safety policy for the task at hand.",
    status: "planned",
    note: "The design starts with one Coordinator, not a roster.",
  },
  {
    index: "05",
    name: "Execution",
    body: "Approved actions run through controlled, reversible integrations.",
    status: "planned",
    note: "Advisory by default; nothing executes without explicit approval.",
  },
  {
    index: "06",
    name: "Audit",
    body: "Decisions, approvals, outcomes and failures are recorded for review.",
    status: "running",
    note: "An append-only activity trail already records what changed — never who merely clicked.",
  },
];

/* ------------------------------------------------------------------ */
/* Obsidian Brain.                                                     */
/* ------------------------------------------------------------------ */

export const MEMORY = {
  headline: "Your tools store files. Obsidian Brain preserves direction.",
  status: "planned" as Status,
  phase: "Phase 03",
  body: [
    "Obsidian Brain is the long-term memory architecture behind ASI.OS. It is designed to capture how work evolves — not only finished results, but the reasoning, failed attempts and corrections that produced them.",
    "The goal is not unlimited storage. The goal is meaningful memory that stays visible, sourced, editable and forgettable.",
  ],
  remembers: [
    "Architecture decisions",
    "Failed implementations",
    "Design references",
    "Security concerns",
    "Current priorities",
    "Unresolved questions",
  ],
  /** The anatomy every memory is specified to carry. */
  fields: [
    { name: "content", detail: "the fact itself, in the user's words or confirmed by them" },
    { name: "source", detail: "where it came from — stated, edited, derived, or inferred" },
    { name: "confidence", detail: "low, medium or high — never a decimal pretending to be precision" },
    { name: "status", detail: "suggested, confirmed, superseded, or forgotten" },
    { name: "history", detail: "every correction, kept; forgetting is auditable without the content" },
  ],
  rules: [
    "Suggested memory is never injected into a prompt. It stays inert until confirmed.",
    "Users can edit, dispute, replace or forget anything stored about them.",
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Agents and model routing.                                           */
/* ------------------------------------------------------------------ */

export const AGENTS = {
  headline: "Different tasks, different intelligence. One shared context.",
  status: "planned" as Status,
  phase: "Phase 05",
  flow: [
    "User objective",
    "Context retrieval",
    "Agent selection",
    "Shared workspace",
    "Recommendation",
  ],
  roster: [
    "Research",
    "Architecture",
    "Development",
    "Security",
    "Financial",
    "Design",
    "Critic",
    "Memory Curator",
  ],
  honesty:
    "The design starts with a single Coordinator. Specialists must each earn entry with a distinct tool boundary — a roster is easy to add and hard to justify.",
} as const;

export const ROUTING = {
  headline: "Route each problem to the right model.",
  status: "proposed" as Status,
  criteria: [
    "Task type",
    "Reasoning depth",
    "Speed",
    "Cost",
    "Privacy",
    "Context size",
    "Tool access",
    "Reliability",
  ],
  honesty:
    "No provider is shown as integrated, because none is. Routing is a design constraint today, not a feature.",
} as const;

/* ------------------------------------------------------------------ */
/* Permission-based execution.                                         */
/* ------------------------------------------------------------------ */

export const APPROVAL = {
  headline: "Authority is granted, never assumed.",
  status: "planned" as Status,
  phase: "Design target — Phase 02",
  body: [
    "ASI.OS begins in an advisory role: it can analyze, organize, recommend and prepare. Execution authority is deliberately enabled by the user, action by action.",
    "The server decides what requires approval — an action registry, not the model's own opinion — so nothing can talk its way past the gate.",
  ],
  fields: [
    { label: "Proposed action", value: "set the project's next action" },
    { label: "Why", value: "the recommendation names the rows it rests on" },
    { label: "Tools involved", value: "internal database write, nothing external" },
    { label: "Data accessed", value: "your own rows only — isolation is enforced below the application" },
    { label: "Risk", value: "low" },
    { label: "Reversibility", value: "undoable; irreversible actions demand stronger confirmation" },
  ],
  verbs: ["Approve", "Edit", "Reject"],
  defaultAuthority: "Advisory",
} as const;

/* ------------------------------------------------------------------ */
/* Trust: enforced now vs. committed by design.                        */
/* ------------------------------------------------------------------ */

export interface TrustClaim {
  claim: string;
  mechanism: string;
}

/** Claims that are true in the repository today, each with its enforcement. */
export const TRUST_ENFORCED: TrustClaim[] = [
  {
    claim: "Account isolation is the database's job",
    mechanism: "Row Level Security, proven against two real accounts on every commit",
  },
  {
    claim: "The application holds no privileged credential",
    mechanism: "a CI guard fails the build if app code could bypass isolation",
  },
  {
    claim: "The audit trail records changes, not clicks",
    mechanism: "append-only activity log; where nothing changed, nothing is written",
  },
  {
    claim: "Unconfigured deployments expose nothing",
    mechanism: "authentication fails closed; private routes become unreachable",
  },
  {
    claim: "A read that fails says so",
    mechanism: "broken queries render as failures, never as an empty account",
  },
];

/** Design commitments for capabilities that do not exist yet. */
export const TRUST_DESIGNED: string[] = [
  "Scoped, least-privilege permissions per agent and per tool",
  "Explicit approval for every consequential action",
  "Revocable integrations that stop reading the moment they are revoked",
  "Reversible actions preferred, with a real undo window",
  "User-owned memory: export, correction, and deletion",
  "Visible uncertainty instead of confident language",
];

/* ------------------------------------------------------------------ */
/* Roadmap.                                                            */
/* ------------------------------------------------------------------ */

export type PhaseStatus = "in_progress" | "planned";

export interface RoadmapPhase {
  index: string;
  name: string;
  body: string;
  status: PhaseStatus;
}

export const ROADMAP: RoadmapPhase[] = [
  {
    index: "01",
    name: "Foundation",
    body: "Architecture, product principles, the security spine, and the first working surfaces: capture, projects, a derived Today, an audit trail.",
    status: "in_progress",
  },
  {
    index: "02",
    name: "Command Center",
    body: "Recommendations with visible evidence, and the four-verb approval loop: approve, edit, snooze, reject.",
    status: "planned",
  },
  {
    index: "03",
    name: "Memory",
    body: "Obsidian Brain: persistent memory with retrieval, confidence, corrections and forgetting.",
    status: "planned",
  },
  {
    index: "04",
    name: "Integrations",
    body: "External tools behind explicit read and write scopes, starting with one read-only connection.",
    status: "planned",
  },
  {
    index: "05",
    name: "Agent orchestration",
    body: "Specialist agents behind real tool boundaries, coordinated through shared context.",
    status: "planned",
  },
  {
    index: "06",
    name: "Automation",
    body: "User-defined workflows with permissions, checkpoints and audit history.",
    status: "planned",
  },
  {
    index: "07",
    name: "Adaptive intelligence",
    body: "Routing, context selection and planning that improve from recorded outcomes.",
    status: "planned",
  },
];

export const CURRENT_STATUS = {
  headline: "Under construction, in the open.",
  body: "The current focus is not autonomy — it is a reliable foundation: clear architecture, database-enforced isolation, an honest audit trail, and surfaces that do real work with real records. Every advanced capability depends on getting these fundamentals right.",
  facts: ["No AI layer yet", "No integrations", "No external network calls"],
} as const;

/* ------------------------------------------------------------------ */
/* Access and footer.                                                  */
/* ------------------------------------------------------------------ */

export const REPO_URL = "https://github.com/DoofXRPL/ASI.OS";

export const ACCESS = {
  headline: "Stop starting over.",
  body: "ASI.OS is being built for people who want continuity across their digital lives: tools that understand what came before, agents that share context, and a system that becomes more useful the longer it is used.",
  note: "Access is by invitation while the foundation is being built. Tell us what you would use it for and we will work through the requests in the order they help us most. The repository is public — the code is the honest changelog.",
  /** Where the request form lives. Real since ADR 0008; before that, absent. */
  href: "/early-access",
  cta: "Request early access",
} as const;
