import { Wordmark } from "@/components/brand/northstar";

/**
 * The footer links to documents in this repository rather than to pages that do
 * not exist. No careers page, no status page, no social row for accounts nobody
 * holds.
 */
const DOCS = [
  { label: "Principles", path: "docs/PRINCIPLES.md" },
  { label: "Architecture", path: "docs/ARCHITECTURE.md" },
  { label: "Data model", path: "docs/DATA-MODEL.md" },
  { label: "Decisions", path: "docs/DECISIONS/" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-5 py-12 md:px-8">
      <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <Wordmark full />

        <div className="flex flex-col gap-3">
          <p className="font-mono text-[11px] tracking-[0.24em] text-ink-faint uppercase">
            Read the reasoning
          </p>
          <ul className="grid gap-2 sm:grid-cols-2 sm:gap-x-10">
            {DOCS.map((doc) => (
              <li key={doc.path} className="text-sm text-ink-muted">
                {doc.label}
                <code className="ml-2 font-mono text-[11px] text-ink-faint">
                  {doc.path}
                </code>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-10 border-t border-line pt-6 text-xs text-ink-faint">
        Adaptive Systems Interface. A private, single-owner system. It observes only
        the records you give it, and it never acts without your approval.
      </p>
    </footer>
  );
}
