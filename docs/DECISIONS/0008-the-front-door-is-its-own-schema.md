# 0008 — The front door is its own schema, and the form is wired

- **Status:** Accepted
- **Date:** 2026-07-30
- **Amends:** [0007](0007-the-front-page-is-a-product-document.md) §6
- **Amended by:** [0009](0009-the-front-door-is-gated-and-metered.md) — §3 and the
  consequence about abuse below are no longer accurate on their own

## Context

ADR 0007 §6 refused an early-access form on the front page: "there is no
early-access form, because there is no endpoint to receive it; *wired or
absent* applies to marketing too." That was the right call at the time. The
only doors were an invitation-only sign-in and the public repository, so
anybody who wanted in had nowhere to say so, and "Request access" pointed at a
sign-in form they could not use.

Building the endpoint runs into the rule that makes the rest of the schema
trustworthy. Every table in `public` carries `user_id uuid not null`, has RLS
keyed to `auth.uid()`, and grants `anon` nothing at all. The schema-wide tests
in `tests/rls/isolation.test.ts` enumerate `public` and assert exactly that, so
the invariant is not a convention — it is a gate.

An early-access request satisfies none of it. It is written by a stranger who
has no account, so there is no owner to key a policy to. Three options were on
the table:

1. **Put it in `public` with a nullable `user_id`.** Rejected. It satisfies the
   letter of the rule while making "ownership" mean nothing, which is precisely
   the ambiguity the rule exists to prevent, and it would force the
   schema-wide test to grow an exception — after which the test proves less
   about every other table too.
2. **Put it in `public` and grant `anon` INSERT.** Rejected. It breaks the
   "anon has no privilege on any table" assertion, and a table `anon` can write
   to is one PostgREST request away from a table someone probes for a `SELECT`
   policy that was never meant to exist.
3. **Give the front door its own schema.** Chosen.

## Decision

1. **`access.early_access_requests` lives outside `public`.** `public` remains
   what it claims to be: one person's records, every row owned, every table
   enumerated. The schema-wide tests are unchanged and still pass, and a new
   test pins the set of schemas so nothing can be hidden in an unlisted one.

2. **The table is unreachable rather than merely protected.** Three layers,
   any one of which would be enough:
   - `access` is absent from the project's exposed schemas, so PostgREST
     cannot address the table even to refuse the request;
   - `anon` and `authenticated` hold no privilege on the table and no `USAGE`
     on the schema;
   - RLS is enabled with no policies, so row access would have to be granted
     deliberately rather than inherited by accident.

3. **The only way in is `public.request_early_access()`,** a `SECURITY
   DEFINER` function with a pinned `search_path` that inserts and **returns
   void**. It cannot report the new id, whether the insert happened, or how
   many rows exist. A duplicate address is absorbed by `on conflict do
   nothing`, so a second submission is neither an error the visitor has to read
   nor a signal that the first one exists.

4. **There is no read path, because nothing reads it.** No page renders these
   rows, so no query helper, RPC or surface exists to fetch them; the owner
   reviews the queue in the database. "Wired or absent" applies to reads as
   well as writes, and a queue viewer nobody has asked for is a surface that
   has not earned its place ([ADR 0002](0002-navigation-earns-its-place.md)).

5. **The form itself is wired end to end.** One Zod schema in
   `lib/schemas/early-access.ts` validates in the browser and again in the
   Server Action; the database constrains the same closed sets a third time,
   and a unit test reads the migration to prove the two lists have not drifted.
   The page works with JavaScript disabled: `action` is the Server Action, and
   the client-side validation is an enhancement layered on top of it.

6. **`/early-access` is the second public surface, and the front page now
   points at it.** The header, hero and closing calls to action lead there
   instead of to `/login`. Sign-in remains what it always was — the door for
   people who already have access.

## Consequences

- Adding a schema means adding a line to `resetDatabase()` in
  `tests/rls/harness.ts`. That is deliberate friction: a schema the harness
  does not know about would survive a reset and leak one run's rows into the
  next.
- A hosted project must **not** add `access` to its exposed schemas. The
  comment in `supabase/config.toml` says so where someone would be tempted.
- `lib/supabase/database.types.ts` gains a `Functions` entry and no new table.
  A compile-time guard in `tests/unit/database-types.test.ts` asserts that
  `early_access_requests` is *not* addressable through `.from()`, because a
  call that compiles and then fails at runtime is the worst of both.
- Abuse is deterred rather than prevented: a honeypot field, one row per
  address, and length bounds in the database. There is no rate limiter, because
  there is no store to keep counters in that would not be the first piece of
  infrastructure built without evidence that it is needed
  ([Principle 10](../PRINCIPLES.md)). If the queue is ever flooded, that is the
  evidence, and the platform's own rate limiting is the first thing to reach
  for.

  *Superseded by [ADR 0009](0009-the-front-door-is-gated-and-metered.md). The
  reasoning held; the mistake was assuming a limiter needs a new store. It needs
  five integers, and PostgreSQL was already here. The more serious gap was that
  granting `EXECUTE` to `anon` made every application-side check optional for an
  attacker, which no amount of deterrence addresses.*
- ADR 0007 §6 no longer describes the product. Its reasoning still holds — a
  form that submits nowhere must not ship — and the change is that it now
  submits somewhere.
