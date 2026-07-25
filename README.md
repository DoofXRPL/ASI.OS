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

## Current state: Phase 0 — foundation and security spine

Phase 0 is complete. It deliberately contains **no AI, no integrations, and no
external calls**.

What works today, with real data:

- **Sign in** — email and password, invite-only (public sign-up is disabled at the
  Supabase project level, which is the real gate).
- **Today** — a truthful one-sentence summary of the system's state, derived from
  your own records, plus recent activity.
- **Activity** — the append-only audit trail. Nothing here can be edited or
  deleted, including by you.
- **Settings** — display name, time zone and clock format. Every control is wired
  to a real record; nothing on the page is a placeholder.

Inbox, Projects, Decisions, Memory and Connections are **not** present. Their
routes return a real 404 because they do not exist yet — see
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

…or by running `supabase/migrations/0001_foundation.sql` in the SQL editor.

Then, in the Supabase dashboard:

1. **Turn off public sign-up** (Authentication → Providers → Email). ASI OS is
   invite-only, and this is where that is actually enforced.
2. **Create your account** (Authentication → Users → Add user). The first account
   to exist automatically becomes the owner, enforced by a unique index.
3. Optionally set `ASI_OWNER_EMAIL` to require that the owner also signs in with
   that address — two independent checks rather than one.

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
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) — the approved plan
- [docs/DECISIONS/](docs/DECISIONS/) — architecture decision records

## Security notes

`npm audit` reports advisories in transitive **development** dependencies
(`brace-expansion`, reached through ESLint). No non-vulnerable version is published
at the time of writing, and the package does not run in production. `postcss` and
`sharp` are pinned forward via `overrides`.

## Licence

See [LICENSE](LICENSE).
