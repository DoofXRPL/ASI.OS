# 0005 — The front page exists, and it states the build

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

The root route redirected: signed-in visitors to `/today`, everyone else to
`/login`. The comment in `app/page.tsx` said so plainly — "ASI OS has no
marketing page. It is a private system, so the root either takes you to your own
records or asks who you are."

That was the right call for Phase 0, and the implementation plan reinforced it:
§2 discards the predecessor's marketing showcase specifically because it shipped a
fabricated orchestration log and a fake "SYNCED" badge. The lesson recorded there
is about fabrication, though, not about landing pages.

The owner asked for a front page. Refusing on the strength of a comment would have
been the wrong reading of the principles: nothing in `docs/PRINCIPLES.md` forbids
explaining the product. What the principles forbid is a page that invents data,
advertises absent features, or offers controls that do nothing — and a landing
page is the easiest place in a codebase to do all three, because it is the one
surface with no rows behind it to contradict it.

## Decision

`/` renders a public front page. It is the only public and the only indexable
surface. Three constraints make it safe to keep:

1. **No fabricated product.** There is no dashboard mockup, no sample project, no
   invented metric, and no screenshot with plausible-looking rows in it. The
   nearest thing to a product preview is the real attention ranking, listed by the
   reason codes `lib/derive/attention.ts` actually emits.
2. **The claims are derived where they can be.** The list of working surfaces is
   generated from `NAV_ITEMS`, so the page cannot name a route the application
   does not serve. The four attention rules are keyed by `AttentionReason`, so
   adding a rule fails typecheck until the page describes it. Anything named as
   not built drops off automatically once it enters the navigation.
3. **What is not built is on the page, in the same type size as what is.** The
   loop is presented as six stages, each carrying its own status: four marked
   *Running*, and Approve and Act marked *Designed, not built*. The hero's count of
   those stages is generated from the same list by `loopStatusSentence`, so prose
   cannot claim a number the data does not support. "Phase 1 of 5", "No AI layer
   yet" and "No external network calls" are in the first screen, not the footer.

A signed-in visitor is **not** redirected away from `/`. The header and both calls
to action become the way back into their own records instead. A root that bounces
you is a root you can never read, and this one is now worth reading.

`/` is added to the proxy matcher. It protects nothing there — `isPrivate("/")` is
false — but the page asks whether the caller is signed in, and Server Components
cannot write refreshed session cookies. Without the matcher entry, a valid session
with an expired access token would read as signed out and be offered a sign-in
link it does not need.

## Consequences

- The product is explicable to somebody who has not been invited, which it
  previously was not.
- `robots: { index: false }` remains the default in the root layout. Only `/`
  overrides it. The exception is stated on the public page rather than the default
  being loosened for everyone.
- The front page is the first surface in this repository that animates for its own
  sake. That is scoped: the motion keyframes are added under a comment in
  `app/globals.css` naming the front page as their only consumer, and the private
  surfaces still animate nothing but state changes.
- A new class of drift is now possible — copy that was true when written. It is
  contained by derivation and by `tests/unit/landing.test.ts`, which asserts the
  working list matches the navigation, that nothing appears in both columns, and
  that every attention rule the derivation emits is described.
- The page describes the loop as a design while the build is behind it. That is
  the one place the design is allowed to run ahead of the code, and it is why each
  stage carries its own status. If a future change removes those statuses, the
  page becomes a promise instead of a description, and this ADR is the thing it
  will be in breach of.
