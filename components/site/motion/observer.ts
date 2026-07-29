/**
 * One IntersectionObserver for every reveal on the page.
 *
 * A hundred sections each holding their own observer is a hundred callbacks the
 * browser must schedule for the same scroll; one shared instance makes reveals
 * O(1) in observers no matter how long the page grows. Elements are marked
 * visible by attribute, never by state — becoming visible is a paint concern,
 * not a render concern.
 */
let shared: IntersectionObserver | null = null;

function show(element: Element): void {
  element.setAttribute("data-visible", "true");
}

export function observeReveal(element: Element | null): () => void {
  if (!element) return () => {};

  if (typeof IntersectionObserver === "undefined") {
    show(element);
    return () => {};
  }

  shared ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          show(entry.target);
          shared?.unobserve(entry.target);
        }
      }
    },
    // Slightly inside the viewport, so nothing plays where it cannot be seen.
    { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
  );

  shared.observe(element);
  return () => shared?.unobserve(element);
}
