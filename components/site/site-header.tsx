import Link from "next/link";
import { Wordmark } from "@/components/brand/northstar";
import { REPO_URL } from "@/lib/site/landing";

const SECTIONS = [
  { href: "#product", label: "Product" },
  { href: "#memory", label: "Memory" },
  { href: "#agents", label: "Agents" },
  { href: "#security", label: "Security" },
  { href: "#roadmap", label: "Roadmap" },
] as const;

/**
 * Compact sticky navigation. Every link resolves to something real: sections
 * of this page, the public repository, and the one door into the system.
 * There is no "Get started", because there is no public sign-up.
 */
export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-canvas/90 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-5 md:px-8">
        {/*
         * An in-page jump rather than a link to `/`, because this header only
         * appears on `/`: navigating to the route you are already on leaves
         * the scroll position untouched, so the mark would look broken.
         */}
        <a
          href="#top"
          className="rounded-md transition-opacity duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:opacity-75"
        >
          <Wordmark variant="light" caption />
          <span className="sr-only">— back to the top</span>
        </a>

        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {SECTIONS.map((section) => (
              <li key={section.href}>
                <a
                  href={section.href}
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
            href={signedIn ? "/today" : "/login"}
            className="inline-flex h-8 items-center rounded-md bg-carbon px-3 text-[13px] font-medium text-white transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:bg-carbon/85"
          >
            {signedIn ? "Open ASI.OS" : "Request access"}
          </Link>
        </div>
      </div>
    </header>
  );
}
