# 0002 — A surface enters the navigation only when it works

- **Status:** Accepted
- **Date:** 2026-07-25

## Context

The approved plan lists eight primary areas: Today, Inbox, Projects, Decisions,
Memory, Connections, Activity, Settings. Phase 0 can genuinely deliver three of
them — Today, Activity and Settings — because the others depend on tables and
reasoning that Phase 0 deliberately does not build.

The obvious alternative was to ship all eight routes as empty shells so the
information architecture is visible from the start.

The predecessor project did exactly that. Roughly ten of its fourteen navigation
entries were inert rows badged "soon": Portfolio, Markets, Research, Agents,
Memory, Workflows, Agent Builder, Security. Its own transition document recorded
the result — the shell looked like a product long before it was one, and the
navigation stopped being a reliable signal of what the system could do.

## Decision

The navigation contains only routes that do real work with real data.

Phase 0 therefore ships three: `/today`, `/activity`, `/settings`. Inbox,
Projects, Decisions, Memory and Connections are not in the navigation and their
routes **do not exist** — requesting `/inbox` returns a genuine 404, which is
true.

Each deferred surface is added in the phase that makes it functional, together with
its tables and its RLS tests.

## Consequences

- Navigation stays a trustworthy inventory of capability. If it is listed, it works.
- The information architecture is not visible from the interface in early phases.
  It lives in `docs/IMPLEMENTATION_PLAN.md` instead, which is the right place for a
  plan.
- This is a deliberate, flagged deviation from the approved Phase 0 scope, which
  listed six empty pages. It follows the plan's own stated principles — "never
  fabricate", "keep the main navigation small", "do not fill it with unfinished
  'coming soon' modules" — over its file list, on the grounds that an empty page
  advertising a feature that does not exist *is* the pattern the plan set out to
  avoid.
- Reversing it is cheap: adding a route and a navigation entry is a few lines. The
  decision is recorded here so the reasoning is not lost if it is revisited.
