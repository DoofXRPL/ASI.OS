# ASI OS — Data model

Phase 0 defines three tables. The rules below apply to every table added later.

## Rules for every user-owned table

1. **`user_id uuid not null references auth.users(id) on delete cascade`.**
   Nullable ownership is a latent leak: a null owner satisfies no policy and
   quietly accumulates unreachable rows.
2. **RLS enabled, and it is the only isolation boundary.** Application filters are
   defence in depth, never the mechanism.
3. **Policies use `(select auth.uid())`,** so PostgreSQL evaluates the caller once
   per statement rather than once per row.
4. **Privileges are granted per column** where a column must not be
   self-assigned. RLS controls which *rows* you may touch; `GRANT` controls which
   *columns*. Both are required — see `profiles.is_owner`.
5. **No privileged credential in application code.** Enforced by
   `npm run guard:service-role`.
6. **A new table without an RLS test fails CI.** The schema-wide tests enumerate
   `public` and assert the expected set, so forgetting is impossible rather than
   merely unlikely.

## `profiles`

One row per account, provisioned automatically on signup.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `user_id` | uuid | not null, unique, FK to `auth.users` |
| `display_name` | text | nullable — a null means the greeting stays generic |
| `timezone` | text | not null, default `UTC`; every timestamp is rendered in it |
| `is_owner` | boolean | not null, default false; **not writable by users** |
| `created_at` / `updated_at` | timestamptz | `updated_at` maintained by trigger |

- The **first account to exist becomes the owner**, decided by the signup trigger.
- A **partial unique index** on `is_owner where is_owner` makes a second owner
  impossible at the database level, including under concurrent signups.
- `authenticated` is granted `update (display_name, timezone)` only. `is_owner` is
  not grantable, so ownership cannot be escalated even by a forged request.
- There is no DELETE policy or privilege: accounts are removed through
  `auth.users`, which cascades.

## `user_settings`

Durable preferences, in Postgres rather than `localStorage` so they are portable,
exportable, and covered by the same isolation guarantees as everything else.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `user_id` | uuid | not null, unique, FK to `auth.users` |
| `settings` | jsonb | not null, default `{}`; must be a JSON object |
| `created_at` / `updated_at` | timestamptz | |

The JSONB payload is validated by `lib/schemas/settings.ts`. Reads are lenient so a
drifted row degrades to defaults rather than blocking access to your own records;
writes are strict so drift is never introduced deliberately.

## `activity_events`

The append-only audit trail.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `user_id` | uuid | not null, FK to `auth.users` |
| `event_type` | text | not null, **unconstrained on purpose** |
| `actor` | text | not null, one of `user`, `agent`, `system` |
| `summary` | text | not null, 1–500 characters |
| `subject_type` / `subject_id` | text / uuid | what the event was about |
| `detail` | jsonb | not null, default `{}`, must be an object |
| `occurred_at` / `created_at` | timestamptz | |

**Append-only at both levels.** There is no UPDATE or DELETE policy *and* no
UPDATE or DELETE privilege. A user can write their own history and read it back;
nobody — including them — can rewrite it. `Update: Record<string, never>` in the
TypeScript types makes calling `.update()` a compile error too.

`event_type` is deliberately unconstrained text. An audit write must never fail
because a new event type has not yet been added to a CHECK constraint: losing the
record of what happened is worse than storing a label the interface does not
recognise. Valid values live in `lib/schemas/activity.ts`, and the Activity page
marks an unrecognised type rather than hiding the row.

## Why `FORCE ROW LEVEL SECURITY` is not used

`FORCE ROW LEVEL SECURITY` would also apply policies to the table owner. That
would break the `SECURITY DEFINER` provisioning trigger, which must insert a
profile for an account that cannot yet see any table, and the idempotent backfill.

The protection it offers is instead achieved by never using an owner or service
credential for user data at all — enforced by `npm run guard:service-role` and by
there being no privileged client in the codebase. This is a deliberate trade, not
an oversight.

## Provisioning

`public.handle_new_user()` runs `AFTER INSERT ON auth.users` and creates the
profile and settings rows. It is `SECURITY DEFINER` because it must write tables
the brand-new account cannot see, and `EXECUTE` is revoked from `public`, `anon`
and `authenticated` so it is reachable only by the trigger. Every function pins
`search_path` so a schema earlier in a caller's path cannot shadow the objects it
resolves; the RLS suite asserts this for every function.

## Coming in later phases

`inbox_items`, `projects`, `tasks`, `notes`, `people`, `memory_items`,
`memory_revisions`, `agent_runs`, `recommendations`, `proposed_actions`,
`decisions`, `actions`, `invitations`, `connections`, `shares`. See
`docs/IMPLEMENTATION_PLAN.md` §7.
