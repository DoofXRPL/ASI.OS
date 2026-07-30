# ASI OS — Data model

Six tables. Five are in `public` and are user-owned: three from Phase 0 that
describe the system, and two from Phase 1 that describe your work. The sixth is
in its own schema and belongs to nobody — see
[The `access` schema](#the-access-schema).

The rules below apply to every table added to `public` later.

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

## `projects`

What you are trying to make true, and the one action that moves it forward.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `user_id` | uuid | not null, FK to `auth.users` |
| `name` | text | not null, 1–120 characters, never blank |
| `outcome` | text | nullable — what will be true when this is done |
| `next_action` | text | nullable, ≤280 — null means you do not yet know |
| `status` | text | one of `active`, `paused`, `blocked`, `done`, `abandoned` |
| `blocked_reason` | text | nullable, ≤500 |
| `last_touched_at` | timestamptz | set by the application, never by a trigger |
| `created_at` / `updated_at` | timestamptz | `updated_at` maintained by trigger |

- **A blocked project must say why, and only a blocked project may carry a
  reason.** `check ((status = 'blocked') = (blocked_reason is not null))`
  enforces both halves. The second half matters as much as the first: a reason
  left behind after unblocking is a stale sentence waiting to be rendered as
  though it were current.
- **Blank is not a value.** Every nullable text column rejects whitespace-only
  input, so "no next action" has exactly one representation.
- **There is no DELETE policy or privilege.** Abandoning is a status. Losing the
  record of what you were trying to do would contradict the Remember stage.
- `unique (user_id, id)` exists as the target of the composite foreign key on
  `inbox_items`.
- See [ADR 0003](DECISIONS/0003-projects-hold-the-next-action.md) for why there
  is no `tasks` table yet.

## `inbox_items`

Captured input, preserved exactly as it was written.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `user_id` | uuid | not null, FK to `auth.users` |
| `content` | text | not null, 1–4000 characters, **not updatable** |
| `kind` | text | nullable — `note`, `task`, `idea`, `question`, `link` |
| `status` | text | `unprocessed`, `processed`, `archived` |
| `project_id` | uuid | nullable, composite FK — see below |
| `processed_into` | text | `project`, `project_next_action`, `project_material`, `archived` |
| `processed_at` | timestamptz | nullable |
| `source` | text | not null, default `manual`, **not updatable** |
| `created_at` / `updated_at` | timestamptz | |

- **The text cannot be rewritten.** `content` carries no UPDATE privilege, so
  "the original input is preserved" is enforced by the database rather than
  promised by the interface. `source` is likewise not updatable, so an origin
  cannot be claimed. See
  [ADR 0004](DECISIONS/0004-capture-is-preserved-by-privilege.md).
- **`kind` is null until you say.** Defaulting to `note` would be ASI
  classifying your input and then showing that guess back to you as if you had
  made it.
- **Processed can never mean nothing.** A CHECK ties `status`, `processed_at`
  and `processed_into` together, and a route naming a project must reference
  one.
- **The project link is a composite foreign key** on `(user_id, project_id)`
  referencing `projects (user_id, id)`. A plain `project_id` key is checked
  outside RLS, so it would accept a link to another account's project and would
  leak whether an identifier exists at all through the difference between
  success and a constraint violation. Including `user_id` closes both. The
  default MATCH SIMPLE semantics skip the check when `project_id` is null, which
  is exactly right for an unlinked capture.
- **No DELETE privilege.** An unwanted capture is archived, which keeps the
  record of having thought it.

## The `access` schema

Everything above is one person's records. `access.early_access_requests` is the
opposite: submissions from strangers who have no account, so there is no owner
to key a policy to and no `user_id` to require. Rather than weaken the rule for
one table, the table sits outside `public` entirely. See
[ADR 0008](DECISIONS/0008-the-front-door-is-its-own-schema.md).

### `access.early_access_requests`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | primary key |
| `name` | text | not null, 1–120 characters, never blank |
| `email` | text | not null, 3–254, lower-cased and trimmed on write |
| `company` | text | nullable, ≤120 |
| `use_case` | text | not null, one of eight known values |
| `other_use_case` | text | nullable, ≤2000 — required iff `use_case = 'other'` |
| `team_size` | text | nullable — `just_me`, `2_10`, `11_50`, `50_plus` |
| `challenge` | text | nullable, ≤2000 |
| `status` | text | not null, default `new`; `reviewing`, `invited`, `declined` |
| `created_at` | timestamptz | not null |

- **Unreachable, not merely protected.** `access` is absent from the exposed
  schemas in `supabase/config.toml`, so PostgREST cannot address the table;
  `anon` and `authenticated` hold no privilege on it and no `USAGE` on the
  schema; and RLS is enabled with no policies as a third layer.
- **One way in.** `public.request_early_access()` is `SECURITY DEFINER`, pins
  `search_path`, and **returns void**. It cannot report the new id or whether
  the insert happened, so the form is not an oracle for "is this address
  already on the list". A duplicate is absorbed by `on conflict do nothing`
  against a unique index on `lower(email)`.
- **An explanation only survives with the category it describes.**
  `check ((use_case = 'other') = (other_use_case is not null))` enforces both
  halves, on the same reasoning as `projects.blocked_reason`.
- **No read path exists.** Nothing renders these rows, so no query helper, RPC
  or surface fetches them; the owner reviews the queue in the database.
  `status` is that review, written by hand.
- The same closed sets live in `lib/schemas/early-access.ts`, and
  `tests/unit/early-access-schema.test.ts` reads this migration to prove the
  two have not drifted apart.

## Coming in later phases

`tasks`, `notes`, `people`, `memory_items`, `memory_revisions`, `agent_runs`,
`recommendations`, `proposed_actions`, `decisions`, `actions`, `invitations`,
`connections`, `shares`. See `docs/IMPLEMENTATION_PLAN.md` §7.
