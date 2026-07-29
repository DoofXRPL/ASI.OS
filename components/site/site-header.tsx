import { Wordmark } from "@/components/brand/northstar";
import { Magnetic } from "./interaction/magnetic";
import { TransitionLink } from "./motion/transition-link";

const SECTIONS = [
  { href: "#loop", label: "The loop" },
  { href: "#today", label: "How Today decides" },
  { href: "#principles", label: "Principles" },
  { href: "#reality", label: "What runs today" },
] as const;

/**
 * The front-page header. Sticky, quiet, and honest about the one action it
 * offers: there is no public sign-up, so there is no "Get started".
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-void/80 backdrop-blur-md">
      {/* The hairline: a border that is brightest where the content is. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-line-strong to-transparent"
      />

      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-6 px-5 md:px-8">
        {/*
         * An in-page jump rather than a link to `/`, because this header only
         * appears on `/`. Navigating to the route you are already on leaves the
         * scroll position where it was, so the mark would look broken; the top
         * of this page is what "home" means from here.
         */}
        <a
          href="#top"
          className="rounded-md transition-opacity duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:opacity-80"
        >
          <Wordmark />
          <span className="sr-only">— back to the top</span>
        </a>

        <nav aria-label="Front page sections" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <a
                  href={section.href}
                  className="rounded-md px-3 py-2 text-sm text-ink-muted transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:bg-raised/70 hover:text-ink"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Magnetic>
          <TransitionLink
            href={signedIn ? "/today" : "/login"}
            className="inline-flex h-8 items-center rounded-md border border-line-strong bg-raised px-3 text-sm font-medium text-ink transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:border-ink-faint"
          >
            {signedIn ? "Open ASI OS" : "Sign in"}
          </TransitionLink>
        </Magnetic>
      </div>
    </header>
  );
}
