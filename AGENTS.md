# AGENTS.md

Guidance for AI agents working in this repository.

> ## The direction has changed — read this first
>
> As of 2026-08-10 this repository is being revamped into a **private AI
> workspace**: chat as the front door, a server-owned tool registry, and visible
> memory, built on the security spine described below.
> **[docs/ODYSSEY-BLUEPRINT.md](docs/ODYSSEY-BLUEPRINT.md) is the plan of record**
> and supersedes this file's "What this product is" and "Current state" sections,
> and `docs/IMPLEMENTATION_PLAN.md` §3–§4 and §15–§18.
>
> Two things did **not** change, and are the reason the revamp is worth doing here
> rather than starting over: the **hard rules below still apply in full**, and RLS
> is still the only isolation boundary.
>
> Those sections are rewritten properly in Phase A task 1 of the blueprint. Until
> that lands, where this file says ASI OS "is not a chatbot", read the blueprint
> instead — and do not treat the sentence as a reason to refuse chat work.

## What this product is

ASI OS (Adaptive Systems Interface) is a **private, single-owner personal
intelligence layer**. Its product is the loop
**Observe → Understand → Recommend → Approve → Act → Remember**.

It is **not** a finance application, a chatbot, a task manager, or a metrics
dashboard. It never acts without human approval.

Read [docs/PRINCIPLES.md](docs/PRINCIPLES.md) before changing anything. Those
principles are review criteria: a change that violates one is wrong even if it
works.

## Current state

**Phase 0 is complete. Phase 1 is partly complete. Phases 2–5 are not started.**
The roadmap is in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). Do
not implement a later phase unless asked.

There is still **no AI layer, no integrations, and no external network calls** by
design.

Working surfaces: `/today`, `/inbox`, `/projects`, `/projects/[id]`, `/activity`,
`/settings`. Decisions, Memory and Connections do not exist yet and must not be
added as empty shells — see
[ADR 0002](docs/DECISIONS/0002-navigation-earns-its-place.md).

Public surfaces: `/` (the product document) and `/early-access` (the request
form). They share `SiteHeader`, `SiteFooter` and the light palette; both pass
`onHome={false}` off the front page so section links resolve.

Shipped in Phase 1 so far: capture with the original text preserved by
privilege; four ways out of the inbox; projects with an outcome, a status, a
next action and a required reason when blocked; a Today derived from those
rows; and a public early-access form whose write is gated by a key the database
verifies and metered by counters it keeps. Still to come in Phase 1: `tasks` and `notes`
([ADR 0003](docs/DECISIONS/0003-projects-hold-the-next-action.md) explains why
they are not here yet), `people`, and export/delete in Settings.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, ESLint 9) |
| `npm run test` | Unit tests only — no I/O, always runnable |
| `npm run test:rls` | RLS tests — needs `TEST_DATABASE_URL` |
| `npm run guard:service-role` | Fails if app code can bypass RLS |
| `npm run intake:key` | Prints an early-access intake key and the SQL to register it |
| `npm run build` | Production build |
| `npm run verify` | Everything CI runs, in CI's order |

CI runs: typecheck → lint → guard → unit → RLS → build.

## Environment

Copy `.env.example` to `.env.local`. Only two variables are required:
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the older
`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

`ASI_INTAKE_KEY` is required for the early-access form to record anything. Without
it the form says requests are not being recorded, which is true: the database
refuses a caller it does not recognise. `npm run intake:key` prints the variable
and the SQL that registers its digest. See [docs/SECURITY.md](docs/SECURITY.md).

Without them the app still builds and runs, every private route redirects to
`/login`, and `/login` names the missing variables. That is the intended
fail-closed behaviour — do not "fix" it by defaulting open.

To skip the sign-in screen while developing, set `ASI_DEV_SIGN_IN_EMAIL` and
`ASI_DEV_SIGN_IN_PASSWORD`. This does not disable authentication — it cannot,
because RLS answers as somebody and an app with no caller is empty rather than
open. It performs a real sign-in in `proxy.ts`, so the session, the cookies and
the RLS boundary are all unchanged. It is inert in a production build and the
account panel states when it is active. See `lib/auth/dev-sign-in.ts`.

## Running the RLS tests without Docker

The suite needs only PostgreSQL 14+, not the Supabase stack:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/asi_test \
  npm run test:rls
```

`tests/rls/auth-shim.sql` supplies the small part of Supabase's `auth` contract the
policies depend on. It lives under `tests/` so it can never be applied to a real
project. Details in [tests/rls/README.md](tests/rls/README.md).

Use a tmux session for long-running servers in Cloud Agent VMs.

## Hard rules

1. **Never use a Supabase service-role or secret key in `app/`, `lib/` or
   `components/`.**    RLS is the only isolation boundary. `npm run guard:service-role`
   enforces this. An escape hatch exists — the comment `asi-allow-privileged` on
   the *same line* — but should essentially never be used.
2. **Never construct a Supabase client directly.** Use
   `lib/supabase/server.ts`. The guard rejects bare `createClient(`.
3. **Every new table in `public` needs `user_id uuid not null`, RLS, and RLS
   tests.** The schema-wide tests enumerate `public` and assert the expected set, so
   a new table without tests fails CI — by design. Data that has no owner does
   not belong in `public`: `access.early_access_requests` is the only such table
   and is unreachable except through one `SECURITY DEFINER` function
   ([ADR 0008](docs/DECISIONS/0008-the-front-door-is-its-own-schema.md)). A new
   schema also needs a line in `resetDatabase()` and a place in the schema
   enumeration test.
4. **Never fabricate data.** No placeholder numbers, sample values, or metrics not
   read from a record. Use the states in `components/os/states.tsx`; there is no
   component for a fake value, and that is deliberate.
5. **Wired or absent.** Do not add a control that does not change anything, and do
   not add a settings key nothing reads.
6. **Every private surface stays `force-dynamic`.** Without it, Next.js prerenders
   the unauthenticated redirect and can serve it to a signed-in visitor.
7. **`lib/supabase/database.types.ts` uses type aliases, not interfaces.** With
   interfaces, PostgREST's schema constraint fails and every query type silently
   becomes `never` while the code still compiles. Guarded by
   `tests/unit/database-types.test.ts`.
8. **Validate at the boundary with Zod.** Forms are a convenience; the server is the
   boundary. Re-validate everything server-side.
9. **A `"use server"` file may only export async functions.** Put shared state
   constants in a sibling module — see `lib/auth/form-state.ts`.
10. **Audit writes must never break the operation they describe,** and must record
    what actually changed, not what might have. Where nothing changed, write
    nothing: a trail that logs saves rather than changes becomes a record of who
    clicked.
11. **A read that fails says so.** Query helpers return `ReadResult<T>` and
    pages render `Failed`. Returning an empty list on error makes a broken
    database look like an empty account, which is the more damaging of the two
    to get wrong.
12. **Derived output must name its evidence.** Anything Today asserts comes from
 a pure function in `lib/derive/` and carries the id of a row it was given.
 Never invent a deadline, a priority, a score, or the word "urgent".
13. **Anything `anon` may execute must be guarded in the database.** The
 publishable key is public, so a check in a Server Action protects only the path a
 visitor happens to take. `public.request_early_access()` requires an intake key
 and meters every caller; a new anonymous entry point needs the same treatment and
 the tests in `tests/rls/intake-guard.test.ts` as a model. See
 [docs/SECURITY.md](docs/SECURITY.md) and
 [ADR 0009](docs/DECISIONS/0009-the-front-door-is-gated-and-metered.md).
14. **No raw IP address goes into any table.** The intake meter counts a keyed
 digest of the address and the UTC date, and the column's CHECK constraint accepts
 nothing else. Logs follow the same rule: `lib/early-access/log.ts` is a closed
 shape with no field for a name, an address, an email or a message.

## Conventions

- Business logic that can be pure goes in `lib/derive/` or `lib/format/` and is
  unit-tested without a database.
- Public copy lives as data in `lib/site/`, and every module there is scanned by
  the banned-language test in `tests/unit/landing.test.ts`. A new public surface
  adds its module to that list.
- Colour carries meaning: blue thinking, amber needs-you, sage confirmed, red
  failed. Never decorative.
- Comments explain constraints and non-obvious intent, never what the next line
  does.
- Record consequential decisions as an ADR in `docs/DECISIONS/`.
