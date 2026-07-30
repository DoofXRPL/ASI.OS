import { Wordmark } from "@/components/brand/northstar";
import { REPO_URL } from "@/lib/site/landing";

/**
 * The footer links only to things that exist: sections of the front page and
 * the written reasoning in the public repository. No careers page, no status
 * page, no social row for accounts nobody holds.
 */
const PRODUCT_LINKS = [
  { label: "Product", hash: "#product" },
  { label: "Architecture", hash: "#architecture" },
  { label: "Obsidian Brain", hash: "#memory" },
  { label: "Agents", hash: "#agents" },
  { label: "Security", hash: "#security" },
  { label: "Roadmap", hash: "#roadmap" },
] as const;

const REASONING_LINKS = [
  { label: "Principles", href: `${REPO_URL}/blob/main/docs/PRINCIPLES.md` },
  { label: "Architecture notes", href: `${REPO_URL}/blob/main/docs/ARCHITECTURE.md` },
  { label: "Data model", href: `${REPO_URL}/blob/main/docs/DATA-MODEL.md` },
  { label: "Decision records", href: `${REPO_URL}/tree/main/docs/DECISIONS` },
  { label: "Repository", href: REPO_URL },
] as const;

/**
 * `onHome` decides whether the section links are in-page anchors or routed
 * back to the front page, for the same reason the header takes it: a bare
 * `#product` on any other route scrolls to nothing.
 */
export function SiteFooter({ onHome = true }: { onHome?: boolean }) {
  const base = onHome ? "" : "/";

  return (
    <footer className="bg-canvas">
      <div className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
        <div className="grid gap-10 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-6">
            <Wordmark variant="light" />
            <p className="mt-3 max-w-sm text-[13px]/5 text-graphite">
              An intelligence operating system developed by Northstar Labs. Advisory before
              autonomous; authority is granted, never assumed.
            </p>
          </div>

          <nav aria-label="Product" className="md:col-span-3">
            <p className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">Product</p>
            <ul className="mt-3 space-y-2">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.hash}>
                  <a
                    href={`${base}${link.hash}`}
                    className="text-[13px] text-graphite transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:text-carbon"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Reasoning" className="md:col-span-3">
            <p className="font-mono text-[11px] tracking-[0.18em] text-mist uppercase">
              Read the reasoning
            </p>
            <ul className="mt-3 space-y-2">
              {REASONING_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[13px] text-graphite transition-colors duration-[var(--duration-hover)] ease-[var(--ease-out)] hover:text-carbon"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-edge pt-6 sm:flex-row sm:items-baseline sm:justify-between">
          <p className="text-xs text-mist">© 2026 Northstar. All rights reserved.</p>
          <p className="text-xs text-mist">
            Built around human authority, persistent memory, and trustworthy intelligence.
          </p>
        </div>
      </div>
    </footer>
  );
}
