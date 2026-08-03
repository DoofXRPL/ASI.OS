# ASI OS

**Adaptive Systems Interface** — a private personal intelligence and coordination
layer across life, work, projects, knowledge and decisions.

Its product is one loop:

**Observe → Understand → Recommend → Approve → Act → Remember**

ASI OS holds a truthful record of your commitments, projects and decisions; reasons
over that record; proposes next actions with visible evidence; acts only with your
permission; and remembers what you confirmed, corrected and decided.

It is not a finance application, a chatbot, a task manager, or a dashboard of
metric cards. It never acts without approval. See [docs/PRINCIPLES.md](docs/PRINCIPLES.md).

## Current state: Phase 1 — a manual system of record

Phase 0 (foundation and security spine) is complete, and Phase 1 has begun. There
is still **no AI, no integrations, and no external calls**.

What works today, with real data:

- **Request early access** — the one public form, and the one write a stranger
  can perform. It goes through a `SECURITY DEFINER` function to a table in its own
  schema, which PostgREST cannot address and no API role holds a privilege on.
  That function requires a key only this deployment holds, so the published
  publishable key is not enough to write to the queue, and it meters every caller
  against limits counted in PostgreSQL. A duplicate address is answered exactly
  like a new one, so the form cannot be used to discover who is already on the
  list. See [ADR 0008](docs/DECISIONS/0008-the-front-door-is-its-own-schema.md),
  [ADR 0009](docs/DECISIONS/0009-the-front-door-is-gated-and-metered.md) and
  [docs/SECURITY.md](docs/SECURITY.md).
- **Sign in** — email and password, invite-only (public sign-up is disabled at the
  Supabase project level, which is the real gate).
- **Inbox** — capture a thought in one field with nothing to decide. The text is
  stored exactly as written and **cannot be edited afterwards, by anyone**, because
  the column carries no update privilege. Later you classify it and send it one of
  four ways: start a project from it, make it a project's next action, attach it
  to a project as context, or archive it.
- **Projects** — an outcome, a status, and the one action that moves it forward.
  A blocked project has to say why, and that sentence is what you are shown
  later — in your words, never paraphrased.
- **Today** — what is true right now, derived from those rows by pure functions.
  Blocked work first, then projects with no next action, then captures waiting,
  then work left untouched. Every item links to the record it came from. When
  nothing needs you it says so with confidence, and when you have never used it
  it says that instead.
- **Activity** — the append-only audit trail. Nothing here can be edited or
  deleted, including by you.
- **Settings** — display name, time zone and clock format. Every control is wired
  to a real record; nothing on the page is a placeholder.

Nothing on any surface is estimated, scored, or given a deadline you did not set.
There are no due dates in this product yet, so nothing in it can be late.

Decisions, Memory and Connections are **not** present. Their routes return a real
404 because they do not exist yet — see
[ADR 0002](docs/DECISIONS/0002-navigation-earns-its-place.md) for why they are not
shipped as empty shells.

The full roadmap is in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

## Privacy model

Row Level Security is the **only** isolation boundary. Application-level filters
are defence in depth, never the mechanism.

The application holds **no privileged database credential**. Every read and write
happens as the signed-in user, so there is no code path that can reach another
account's records — not a bug to be avoided, but a capability that does not exist.

- `npm run guard:service-role` fails the build if application code references a
  credential that bypasses RLS.
- `npm run test:rls` proves isolation against a **real PostgreSQL database** with
  the **real policies** and **two real accounts**. Nothing is mocked. See
  [tests/rls/README.md](tests/rls/README.md).

Two further guarantees are enforced by privilege rather than by application code,
and proven the same way: the audit trail cannot be rewritten, and neither can a
capture. A capture also cannot be linked to another account's project — the
foreign key includes the owner, so the attempt fails identically to referencing a
project that does not exist, and cannot be used to discover that one does.

## Getting started

Requires Node 20.11+ and a Supabase project.

```bash
npm install
cp .env.example .env.local   # then fill in the two required values
```

Apply the schema — either with the Supabase CLI:

```bash
supabase db reset            # local stack
supabase db push             # hosted project
```

…or by running each file in `supabase/migrations/` in the SQL editor, in order.

Leave **Settings → API → Exposed schemas** as `public`. The early-access queue
lives in `access` precisely so it cannot be reached over the API.

Then, in the Supabase dashboard:

1. **Turn off public sign-up** (Authentication → Providers → Email). ASI OS is
   invite-only, and this is where that is actually enforced.
2. **Create your account** (Authentication → Users → Add user). The first account
   to exist automatically becomes the owner, enforced by a unique index.
3. Optionally set `ASI_OWNER_EMAIL` to require that the owner also signs in with
   that address — two independent checks rather than one.

Then open the front door, which takes a key in two halves:

```bash
npm run intake:key           # prints the variable to set and the SQL to run
```

Set `ASI_INTAKE_KEY` in the environment and run the printed `insert` against the
project it belongs to. Until both are done the early-access form reports that
requests are not being recorded — which is true, because the database refuses a
caller it does not recognise. Full reasoning and a launch checklist are in
[docs/SECURITY.md](docs/SECURITY.md).

```bash
npm run dev                  # http://localhost:3000
```

Without Supabase configured, every private route is unreachable and the sign-in
page names the exact missing variables. That is intentional: an unconfigured
deployment exposes nothing.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Unit tests |
| `npm run test:rls` | Row Level Security tests (needs `TEST_DATABASE_URL`) |
| `npm run guard:service-role` | Fail if application code can bypass RLS |
| `npm run db:reset` | Rebuild the test database from migrations |
| `npm run intake:key` | Generate an early-access intake key and the SQL to register it |
| `npm run verify` | Everything CI runs |

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS 4 · Supabase Auth and
Postgres with RLS · Zod at every boundary · Vitest.

No vector database, queue, background worker, realtime layer or cron job. Each will
be added in the phase that needs it, with the evidence that it is needed.

## Documentation

- [docs/PRINCIPLES.md](docs/PRINCIPLES.md) — the review criteria
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the pieces fit together
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — tables, policies and why
- [docs/SECURITY.md](docs/SECURITY.md) — the anonymous intake path: threat model,
  layers, failure modes and launch checklist
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — the approved plan
- [docs/AUDIT-2026-08-03.md](docs/AUDIT-2026-08-03.md) — what is built, what is
  wrong with it, and the route to Beta, read at one commit and dated because of it
- [docs/DECISIONS/](docs/DECISIONS/) — architecture decision records

## Security notes

`npm audit` reports advisories in transitive **development** dependencies
(`brace-expansion`, reached through ESLint). No non-vulnerable version is published
at the time of writing, and the package does not run in production. `postcss` and
`sharp` are pinned forward via `overrides`.

## Licence

See [LICENSE](LICENSE).
