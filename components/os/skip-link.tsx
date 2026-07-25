/**
 * The first thing a keyboard reaches, and invisible until it does.
 *
 * Without it, every page begins with the whole navigation, which is a small
 * tax that is paid on every single navigation by exactly the people least able
 * to afford it.
 */
export function SkipLink() {
  return (
    <a
      href="#content"
      className="sr-only rounded-md bg-raised px-3 py-2 text-sm text-ink focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:border focus:border-accent"
    >
      Skip to content
    </a>
  );
}
