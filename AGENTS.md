# AGENTS.md

Guidance for AI agents working in this repository.

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

**Phase 0 is complete. Phases 1–5 are not started.** The roadmap is in
[docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). Do not implement a later
phase unless asked.

Phase 0 contains **no AI layer, no integrations, and no external network calls** by
design.

Working surfaces: `/today`, `/activity`, `/settings`. Inbox, Projects, Decisions,
Memory and Connections do not exist yet and must not be added as empty shells — see
[ADR 0002](docs/DECISIONS/0002-navigation-earns-its-place.md).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on port 3000 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (flat config, ESLint 9) |
| `npm run test` | Unit tests only — no I/O, always runnable |
| `npm run test:rls` | RLS tests — needs `TEST_DATABASE_URL` |
| `npm run guard:service-role` | Fails if app code can bypass RLS |
| `npm run build` | Production build |
| `npm run verify` | Everything CI runs, in CI's order |

CI runs: typecheck → lint → guard → unit → RLS → build.

## Environment

Copy `.env.example` to `.env.local`. Only two variables are required:
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the older
`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

Without them the app still builds and runs, every private route redirects to
`/login`, and `/login` names the missing variables. That is the intended
fail-closed behaviour — do not "fix" it by defaulting open.

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
   a new table without tests fails CI — by design.
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
    what actually changed, not what might have.

## Conventions

- Business logic that can be pure goes in `lib/derive/` or `lib/format/` and is
  unit-tested without a database.
- Colour carries meaning: blue thinking, amber needs-you, sage confirmed, red
  failed. Never decorative.
- Comments explain constraints and non-obvious intent, never what the next line
  does.
- Record consequential decisions as an ADR in `docs/DECISIONS/`.
