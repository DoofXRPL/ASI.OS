# ASI OS — Architecture

How the pieces fit together, for someone reading the codebase fresh.

## Layers

```
components/          UI. Never imports lib/db or lib/audit directly for writes.
      │
app/  │              Routes, Server Components, Server Actions. The seam.
      ▼
lib/                 Everything that is not React.
      ├─ auth/       Identity resolution and route guards
      ├─ db/         Typed queries per entity
      ├─ audit/      The append-only activity trail
      ├─ derive/     Pure functions over rows (unit-testable, no I/O)
      ├─ format/     Presentation helpers (pure)
      ├─ schemas/    Zod schemas — the single source of truth at every boundary
      └─ supabase/   Client construction and environment resolution
      ▼
Supabase Postgres    RLS is the isolation boundary.
```

**Invariant:** secrets and database access live on the server. The client never
constructs a database client — `scripts/guard-service-role.ts` fails the build if
`createClient(` appears anywhere under `app/`, `lib/` or `components/`.

## Request flow

A page load of `/today`:

1. `proxy.ts` refreshes the Supabase session and validates the JWT with
   `auth.getUser()`. If there is no user, it redirects to `/login` — including when
   Supabase is unconfigured, so an unconfigured deployment exposes nothing.
2. `app/(os)/layout.tsx` independently calls `requireAuthedSession()`. The proxy is
   a convenience; this is the guarantee.
3. The page reads records through `lib/db/*` and `lib/audit/*`, which use the
   server client authenticated **as the caller**. PostgreSQL evaluates RLS against
   the real user.
4. `lib/derive/today.ts` turns rows into sentences. It is pure, so what the page
   says can be tested exhaustively without a database.
5. The page renders one of the honest states from `components/os/states.tsx`.

A write, such as saving identity:

1. The form posts to a Server Action in `app/(os)/settings/actions.ts`.
2. The action re-validates every value with Zod. The form is a convenience; the
   server is the boundary.
3. `lib/db/profile.ts` performs the update as the caller.
4. `lib/audit/log.ts` records **what actually changed**. Recording a change that
   did not happen would make the history less trustworthy, and a history you cannot
   trust is worse than none.
5. `revalidatePath` refreshes the affected surfaces.

## Identity

`lib/auth/session.ts` is the only place that calls `auth.getUser()`. It returns no
access token: the server client is already authenticated as the user, so a token
never travels through application code and therefore cannot be logged or forwarded
by accident.

Ownership requires two independent signals to agree — the database's `is_owner`
flag and, when `ASI_OWNER_EMAIL` is set, the signed-in address. Neither a database
compromise nor a misconfigured variable confers ownership alone. See
`checkOwner()`, tested in `tests/unit/owner.test.ts`.

## Rendering and caching

Every private surface is `force-dynamic`. There is no ISR, no `use cache`, and no
prerendering of authenticated pages.

This is explicit rather than incidental: without it, Next.js prerenders the
unauthenticated redirect at build time and can serve that response to a signed-in
visitor. A stale page in a product about commitments is a wrong page.

## Database

Three tables, all with `user_id uuid not null` and RLS enabled. See
`docs/DATA-MODEL.md`.

Migrations are versioned and applied in order from `supabase/migrations/`. The RLS
suite applies them to an empty database on every run, so a migration that only
works against an already-populated database fails CI rather than production.

## Types

`lib/supabase/database.types.ts` is hand-maintained until a hosted project exists.
It is declared with **type aliases, not interfaces** — PostgREST's schema
constraint depends on implicit index signatures, which TypeScript infers for type
aliases but not for interfaces. As interfaces, every query type silently degrades
to `never` and all database type safety is lost while the code still compiles.
That failure mode is invisible, so `tests/unit/database-types.test.ts` asserts it
at compile time, and the RLS suite asserts the real column shape.

## What is deliberately absent

No AI layer, vector database, queue, background worker, realtime subscription,
cron job, or external integration. Each will be added in the phase that needs it,
with the evidence that it is needed. See `docs/IMPLEMENTATION_PLAN.md`.
