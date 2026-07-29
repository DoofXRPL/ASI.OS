import Link from "next/link";
import { Wordmark } from "@/components/brand/northstar";

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
        <Link
          href="/"
          className="rounded-md transition-opacity duration-150 hover:opacity-80"
        >
          <Wordmark />
          <span className="sr-only">Adaptive Systems Interface — home</span>
        </Link>

        <nav aria-label="Front page sections" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <a
                  href={section.href}
                  className="rounded-md px-3 py-2 text-sm text-ink-muted transition-colors duration-150 hover:bg-raised/70 hover:text-ink"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <Link
          href={signedIn ? "/today" : "/login"}
          className="inline-flex h-8 items-center rounded-md border border-line-strong bg-raised px-3 text-sm font-medium text-ink transition-colors duration-150 hover:border-ink-faint"
        >
          {signedIn ? "Open ASI OS" : "Sign in"}
        </Link>
      </div>
    </header>
  );
}
