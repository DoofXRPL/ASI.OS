/**
 * The navigation spine.
 *
 * Every entry here is a route that exists and does real work with real data.
 *
 * A surface enters this list in the phase that makes it functional, never
 * earlier. Inbox, Projects, Decisions, Memory and Connections are therefore
 * absent today: shipping them as empty shells badged "soon" would teach the
 * reader that navigation cannot be trusted, which is the most expensive lesson a
 * product about trust can teach. See docs/DECISIONS/0002-navigation-earns-its-place.md.
 *
 * `stage` names the part of the loop each surface serves —
 * Observe, Understand, Recommend, Approve, Act, Remember — because a surface that
 * cannot name its stage is decoration.
 */
export const LOOP_STAGES = [
  "Observe",
  "Understand",
  "Recommend",
  "Approve",
  "Act",
  "Remember",
  "System",
] as const;

export type LoopStage = (typeof LOOP_STAGES)[number];

export interface NavItem {
  href: string;
  label: string;
  stage: LoopStage;
  /** Shown under the page title so each surface states its own purpose. */
  purpose: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/today",
    label: "Today",
    stage: "Observe",
    purpose: "What is true right now, drawn from your own records.",
  },
  {
    href: "/activity",
    label: "Activity",
    stage: "Remember",
    purpose:
      "An append-only record of everything that has happened in this system.",
  },
  {
    href: "/settings",
    label: "Settings",
    stage: "System",
    purpose: "Identity, privacy, and how ASI behaves.",
  },
];

export function findNavItem(href: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.href === href);
}
