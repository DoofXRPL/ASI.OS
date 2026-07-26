# Row Level Security tests

Row Level Security is the **only** isolation boundary in ASI OS. Application-level
`where user_id = ...` filters are defence in depth, never the mechanism. So this
suite is a required CI gate, not an optional extra.

It runs against a **real PostgreSQL database** with the **real policies** from
`supabase/migrations/`, using **two real accounts**. Nothing here is mocked.

## Why not the Supabase CLI

The suite needs PostgreSQL and the small part of Supabase's `auth` contract that
the policies actually depend on — the `anon`/`authenticated`/`service_role` roles,
`auth.users`, and `auth.uid()`. It does not need PostgREST, GoTrue, Studio, or
Docker.

`auth-shim.sql` provides exactly that. Its `auth.uid()` resolves the caller from
the `request.jwt.claims` setting through the same mechanism Supabase uses, so a
policy that isolates users here isolates users in production. What is under test
is the policy, not the shim.

The shim lives under `tests/` and never under `supabase/migrations/`, so it can
never be applied to a real project.

## Running locally

Any disposable PostgreSQL 14+ database works. The database name must contain
`test`, because the suite drops and recreates schemas.

```bash
# Example: a local cluster
createdb asi_test

TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/asi_test \
  npm run test:rls
```

To rebuild the database without running the suite:

```bash
TEST_DATABASE_URL=... npm run db:reset
```

## What is asserted

Every denial is paired with a **positive control** proving the owner can reach
their own row. Without that pairing, a policy that denied everyone would pass the
entire suite.

- **Provisioning** — signup creates exactly one profile and one settings row; the
  display name comes from signup metadata and stays null when absent; the first
  account is the owner and no later account is; a second owner is refused by a
  partial unique index; deleting an account cascades every owned row.
- **Schema-wide guarantees** — every table in `public` has RLS enabled and a
  `NOT NULL user_id`; the column shape matches what the application types expect;
  `anon` has no privilege on any table; every function pins `search_path`; the
  provisioning function is unreachable from API roles.
- **Per-table isolation** — for all five tables: a user reads and writes their own
  rows, cannot see another's rows even when the row id is known, affects zero rows
  when updating another's, and is refused when inserting a row owned by someone
  else.
- **Captured text is immutable** — `inbox_items.content` has no UPDATE privilege
  and the statement is rejected, paired with a positive control showing that the
  classification and status around it still change.
- **Cross-account linking is impossible** — a capture cannot reference another
  account's project, and the composite foreign key fails identically for a project
  that does not exist, so it cannot be used to discover that one does.
- **A blocked project says why** — blocking without a reason is rejected, and so is
  keeping a reason on a project that is no longer blocked.
- **Processed can never mean nothing** — status, `processed_at` and
  `processed_into` must agree, and a route naming a project must reference one.
- **Nothing is deletable** — neither `projects` nor `inbox_items` grants DELETE,
  and neither defines a DELETE policy.
- **Privilege escalation** — a user cannot grant themselves `is_owner`, because
  the column is not granted at all.
- **Audit immutability** — `activity_events` has no UPDATE or DELETE policy and no
  UPDATE or DELETE privilege, so a user cannot rewrite or erase their own history.
- **Constraints** — settings must be a JSON object; the audit actor must be one of
  a known set.

## Adding a table

A new table in `public` without a matching RLS test fails this suite: the
schema-wide tests enumerate `public` and assert the expected set. That is
deliberate — it makes forgetting impossible rather than merely unlikely.
