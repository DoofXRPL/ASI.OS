import Link from "next/link";
import { Wordmark } from "@/components/brand/northstar";
import { REPO_URL } from "@/lib/site/landing";

const SECTIONS = [
  { hash: "#product", label: "Product" },
  { hash: "#memory", label: "Memory" },
  { hash: "#agents", label: "Agents" },
  { hash: "#security", label: "Security" },
  { hash: "#roadmap", label: "Roadmap" },
] as const;

/**
 * Compact sticky navigation. Every link resolves to something real: sections
 * of the front page, the public repository, and the two doors into the
 * system — the request form for people who do not have access, and sign-in
 * for people who do. There is no "Get started", because there is no public
 * sign-up.
 *
 * `onHome` decides whether the section links are in-page anchors or routed
 * back to the front page. It is not cosmetic: a bare `#product` on any other
 * route scrolls to nothing.
 */
export function SiteHeader({
  signedIn,
  onHome = true,
}: {
  signedIn: boolean;
  /** False on every public page except `/`. */
  onHome?: boolean;
}) {
  const base = onHome ? "" : "/";

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-canvas/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
        {/*
         * On the front page this is an in-page jump rather than a link to `/`:
         * navigating to the route you are already on leaves the scroll
         * position untouched, so the mark would look broken. Everywhere else
         * it is the way home.
         */}
        <Link
          href={onHome ? "#top" : "/"}
          className="rounded-md transition-opacity duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:opacity-75"
        >
          <Wordmark variant="light" caption />
          <span className="sr-only">{onHome ? "— back to the top" : "— back to the front page"}</span>
        </Link>

        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {SECTIONS.map((section) => (
              <li key={section.hash}>
                <a
                  href={`${base}${section.hash}`}
                  className="rounded-md px-3 py-2 text-[13px] text-graphite transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:bg-wash hover:text-carbon"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={REPO_URL}
            rel="noreferrer"
            target="_blank"
            className="hidden h-8 items-center rounded-md px-3 text-[13px] text-graphite transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:bg-wash hover:text-carbon sm:inline-flex"
          >
            GitHub
          </a>
          <Link
            href={signedIn ? "/today" : onHome ? "/early-access" : "/login"}
            className="inline-flex h-8 items-center rounded-md bg-carbon px-3 text-[13px] font-medium text-white transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:bg-carbon/85"
          >
            {signedIn ? "Open ASI.OS" : onHome ? "Request access" : "Sign in"}
          </Link>
        </div>
      </div>
    </header>
  );
}
