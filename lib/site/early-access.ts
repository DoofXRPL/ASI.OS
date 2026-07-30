/**
 * What the early-access page is allowed to say.
 *
 * Held to the same rule as `lib/site/landing.ts`: the copy lives as data next
 * to the code that can contradict it, and `tests/unit/landing.test.ts` scans
 * this module for the marketing language the product has banned for itself.
 *
 * The page asks for four things it will act on and nothing it will not. There
 * is no promise of a date, no queue position, and no count of how many people
 * have asked — a waiting list that invents its own momentum is the first lie a
 * product tells.
 */

export const EARLY_ACCESS = {
  eyebrow: "Early access",
  headline: "Request early access",
  lead: "ASI.OS is currently in active development.",
  support:
    "Tell us how you plan to use it so we can prioritize the right builders during early access.",
  /** Stated before the first field, so nobody types an answer under a wrong assumption. */
  note: "Access is by invitation while the foundation is being built. There is no public sign-up, and no date to promise you yet.",

  sections: {
    about: {
      title: "About you",
      description: "So we know who we are replying to.",
    },
    useCase: {
      title: "Primary use case",
      description: "Pick the one closest to the work you would bring to it.",
    },
    context: {
      title: "A little more context",
      description: "Optional. It changes the order we work through requests, not whether we read yours.",
    },
  },

  labels: {
    name: "Full name",
    email: "Email address",
    company: "Company",
    companyHint: "Optional",
    otherUseCase: "Tell us what you’re building or how you’d use ASI.OS.",
    teamSize: "Team size",
    challenge: "Biggest challenge",
    challengePlaceholder: "What’s the biggest problem you’re hoping ASI.OS solves?",
  },

  submit: "Request early access",
  submitPending: "Sending your request…",

  success: {
    headline: "You’re on the list.",
    body: "Thanks for your interest. We’ll review your request and reach out as ASI.OS evolves.",
    /** True because it is what the database did — nothing more is claimed. */
    receipt: "Your request has been recorded.",
    action: "Return home",
  },

  /** Shown beneath the form, where a reader is deciding whether this is worth their time. */
  privacy:
    "Your answers are stored in the project's own database and used to decide who is invited next. Nothing is shared with anyone else, and there is no mailing list to unsubscribe from.",
} as const;
