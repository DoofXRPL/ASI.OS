# 0006 — The front page is five layers, and its motion is one language

- **Status:** Accepted
- **Date:** 2026-07-29

## Context

The first cut of the front page (ADR 0005) grew the way front pages do: each
section owned a little animation, the hero owned its own backdrop, the pointer
spotlight owned its own listener, and delays were literals chosen per call site.
It worked, but three of its numbers already disagreed with each other, and every
new effect would have been a new private implementation of the same idea.

The owner asked for a re-architecture into separated visual and motion systems
rather than another restyle.

## Decision

The front page is built from five layers with one dependency direction.
Sections may use the layers; the layers never reach into sections.

1. **Design tokens** (`app/globals.css` `@theme`). Colour, type, radius — and now
   the motion language: two curves (`--ease-out` in, `--ease-exit` out), three
   durations (hover, reveal, page), one stagger step, one rise distance, one
   blur. These eight values *are* the motion design. `lib/site/motion.ts`
   mirrors the ones script code needs, and `tests/unit/motion-tokens.test.ts`
   parses the stylesheet and fails the moment mirror and source disagree.

2. **Static interface** (`components/site/*.tsx`). Header, hero, sections,
   footer, `CtaLink`. No animation decisions live here beyond choosing a
   stagger index and a direction.

3. **Motion** (`components/site/motion/`). `Reveal` (the one entrance: rise,
   sharpen, fade — every arrival on the page is this component), `Stagger`
   (indexes a run of Reveals without delay arithmetic at call sites, keeping
   `<ol>`/`<dl>` semantics), `TransitionLink` (plays the exit — the entrance in
   reverse — then navigates after exactly the page duration token), one shared
   IntersectionObserver, and the `hover-raise` utility on the hover tokens.

4. **Ambient** (`components/site/ambient/`). One fixed, aria-hidden backdrop:
   grid, two drifting lights, star field, broadcast noise. All CSS — gradients
   and one inline SVG. Canvas/WebGL was considered and rejected: nothing here
   needs per-pixel work, and a shader would spend battery to reproduce what the
   compositor does for free. The trigger to revisit is a wanted effect that CSS
   demonstrably cannot hold at 60fps.

5. **Interaction** (`components/site/interaction/`). `PointerRoot` is the single
   source of pointer state: raw, eased (one lerp), and normalised positions as
   variables on `<html>`, plus `data-pointer="mouse"` on the first real mouse
   move. The custom cursor, the spotlight and the ambient `Depth` parallax only
   consume those variables — there is exactly one trailing position in the
   system, which is why the ring, the light and the room move together.
   `ScrollProgress` does the same for scroll (`--scroll-progress`, `--scroll-y`).
   `Magnetic` leans a control a clamped few pixels toward the pointer.

## Synchronisation, stated as rules

- An entrance is always: rise `--motion-distance`, shed `--motion-blur`, over
  `--duration-reveal`, on `--ease-out`, staggered by `--motion-stagger-step`.
- A departure is the entrance reversed on `--ease-exit`, and navigation waits
  for it: `TransitionLink` defers by the same token the CSS animates with.
- Everything that trails the pointer trails through the same eased variables.
- Hover is always `--duration-hover` on `--ease-out`.
- A component that wants a different number is asking to change the language,
  which means changing the token — visibly, for everything at once.

## Performance rules

- Compositor-only motion: transforms and opacity. The spotlight is an oversized
  statically-painted gradient that is translated, never repainted. The only
  filter transition is the reveal blur, which runs once per element and ends.
- One IntersectionObserver for all reveals; one rAF loop for the pointer, which
  parks when the eased position converges; one rAF-coalesced scroll listener.
- `will-change` only while it earns something: on hidden reveals, dropped once
  settled; on the handful of fixed layers that move every frame.
- Touch and reduced motion cost nothing: the variables are never written, so
  every consumer computes to zero.

## Consequences

- The reference-style motion vocabulary (staggered blur-rise entrances, trailing
  spotlight, custom cursor, magnetic controls, ambient depth) reads as one
  decision, and retuning the whole page is editing eight tokens.
- Private surfaces are untouched: every layer here is scoped to the front page,
  and the state-change-only animation rule inside the product still holds.
- The cursor is replaced (`cursor: none`) only under `data-pointer="mouse"`,
  only within `[data-site]` — keyboard focus, touch input and every other page
  keep native behaviour.
- More files. That is the point: the cost of the first architecture was not
  line count, it was that no one place could say what the page's motion was.
