/**
 * The first thing a keyboard reaches on a public page, and invisible until it
 * does.
 *
 * `components/os/skip-link.tsx` does the same job inside the application; this
 * is the same link in the site palette. Both point at `#content`, which every
 * page marks on its `<main>`.
 */
export function SiteSkipLink() {
  return (
    <a
      href="#content"
      className="sr-only rounded-md border border-edge-strong bg-panel px-3 py-2 text-[13px] font-medium text-carbon shadow-lift focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
    >
      Skip to content
    </a>
  );
}
