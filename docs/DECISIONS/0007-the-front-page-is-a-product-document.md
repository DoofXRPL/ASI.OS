# 0007 — The front page is a product document, not a cinema

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

The first two iterations of the front page (ADRs 0005 and 0006) were honest
about the build but wrong about the register: a near-black canvas, a star
field, aurora glows, a glowing mark, a custom cursor with a trailing ring, a
pointer spotlight, magnetic buttons, blur-heavy reveals and an exit transition.
Individually defensible, together they read as dark cinematic sci-fi — closer
to a defense-technology trailer than to an infrastructure product a serious
engineer would evaluate.

The owner asked for a redesign in the register of a technical infrastructure
company: light-first, restrained, grid-based, product-led, with Vercel as the
reference for rhythm and credibility — and with the honesty rules kept intact.

## Decision

1. **Light-first, two palettes, one meaning system.** The site reads as ink on
   paper: canvas, panel, wash, carbon, thin `edge` borders, and one restrained
   accent. The application palette stays dark and untouched. Dark surfaces
   appear on the site only where the product itself (which is dark) is shown.

2. **The page is ordered as a technical argument** — what it is, what it looks
   like, the problem, the architecture, memory, orchestration, approval,
   trust, status, roadmap, access — with varied compositions on one 12-column
   grid, instead of a parade of centered slogans.

3. **Every claim carries a build status.** A `Status` vocabulary (`running`,
   `in development`, `planned`, `proposed`) is part of the content model, and
   unit tests constrain it: only the audit layer and the shipped surfaces may
   claim `running`; the roadmap has exactly one phase in progress and none
   complete; a banned-language test keeps marketing words out of the copy.

4. **Mock interfaces are allowed only as labelled design targets.** This
   refines ADR 0005's "no fabricated product": the Command Center preview and
   the approval checkpoint are rendered as `<figure>` specifications with
   visible "Design target — Phase 02" labels and captions stating that no live
   system renders them. Their controls are static chips, never `<button>`
   elements, so assistive technology never meets a control that does nothing.

5. **The ambient and interaction theatre is removed**, not restyled: star
   field, aurora, conic sweep, pointer spotlight, custom cursor, magnetic
   buttons, pointer parallax, scroll-progress bar, exit page transition, and
   the blur component of reveals. What survives of the motion system is the
   part that communicates arrival: a 12px rise-and-fade on one curve, staggered
   at 60ms, plus hover feedback — all still token-driven and mirror-tested.

6. **Navigation and calls to action link only to things that exist**: page
   sections, the public repository (now the "documentation" surface), and the
   invitation-only sign-in. There is no early-access form, because there is no
   endpoint to receive it; "wired or absent" applies to marketing too.

## Consequences

- The identity no longer depends on darkness. If a dark mode is wanted later,
  it is a second theme over the same tokens, not a return of the old canvas.
- The Northstar mark gains a light variant (solid blacked-out star) and loses
  its halo and sweep; the favicon and the application usage are unchanged.
- Several previously demonstrated systems (cursor, spotlight, magnetism,
  parallax) are deleted rather than kept dormant. Restoring any of them is a
  new decision against this record, not a revert.
- The public roadmap speaks the product's phase names (01 Foundation through
  07 Adaptive intelligence). The engineering plan in
  `docs/IMPLEMENTATION_PLAN.md` keeps its own numbering; the page maps phase
  status, not phase names, and marks only Foundation as in progress.
