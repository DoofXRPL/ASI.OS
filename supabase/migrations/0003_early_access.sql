-- ============================================================================
-- ASI OS — 0003_early_access
--
-- The front door. One table, and it deliberately does not live in `public`.
--
-- Every table in `public` is one person's records: `user_id uuid not null`,
-- RLS keyed to `auth.uid()`, and no privilege for `anon` at all. That
-- invariant is what makes the schema-wide tests in tests/rls/isolation.test.ts
-- mean anything, and an early-access request breaks all of it — it is written
-- by a stranger who has no account, so there is no owner to key a policy to.
--
-- Rather than weaken the rule for one table, this migration puts the intake
-- queue in its own schema:
--
--   access.early_access_requests  — submissions from the public page
--
-- The security model here is inverted relative to `public`. There, RLS decides
-- which rows you may touch. Here, nothing may touch the table at all:
--
--   1. `access` is not in the project's exposed schemas, so PostgREST cannot
--      reach the table even to be refused.
--   2. `anon` and `authenticated` hold no privilege on the table, and no USAGE
--      on the schema. RLS is enabled with no policies as a third layer, so if
--      either of the first two were ever loosened by accident, the answer is
--      still "no rows".
--   3. The only way in is `public.request_early_access(...)`, a SECURITY
--      DEFINER function that inserts and returns nothing. It cannot be used to
--      read the queue, to count it, or to discover whether an address is
--      already in it.
--
-- Reading the queue is therefore a database operation performed by the owner,
-- not an application capability. That is deliberate: no surface displays these
-- rows yet, and "wired or absent" applies to read paths too.
--
-- See docs/DECISIONS/0008-the-front-door-is-its-own-schema.md.
-- ============================================================================

create schema if not exists access;

comment on schema access is
  'Submissions from unauthenticated visitors. Not exposed to PostgREST; reachable only through SECURITY DEFINER functions in public.';

-- Nobody reaches this schema by name. Revoking USAGE means even a future
-- accidental table-level GRANT resolves to "permission denied for schema".
revoke all on schema access from public, anon, authenticated;

-- ============================================================================
-- access.early_access_requests
--
-- Shape notes:
--
--   * There is no `user_id`, because there is no user. A nullable one would be
--     worse than none: it would satisfy the letter of the rule while making
--     "ownership" mean nothing, which is exactly the ambiguity the rule exists
--     to prevent.
--   * `status` is the owner's triage column and starts at 'new'. It is
--     constrained rather than free text so a queue can never contain a state
--     nothing knows how to read.
--   * Every text column is length-bounded and non-blank-checked here as well
--     as in `lib/schemas/early-access.ts`. The form is a convenience; this is
--     the boundary.
-- ============================================================================

create table if not exists access.early_access_requests (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  email           text not null,
  company         text,
  use_case        text not null,
  -- Required when, and only when, the use case is 'other'. A free-text answer
  -- that contradicts the chosen category is not a record of what was said.
  other_use_case  text,
  team_size       text,
  challenge       text,
  status          text not null default 'new',
  created_at      timestamptz not null default now(),

  constraint early_access_name_shape
    check (char_length(name) between 1 and 120 and btrim(name) <> ''),

  -- Deliberately permissive: the one thing a submission form must not do is
  -- refuse a real address because a regex disagrees with the RFC. This rejects
  -- what is obviously not an address — no '@', whitespace, no dot in the
  -- domain — and leaves deliverability to the reply.
  constraint early_access_email_shape
    check (
      char_length(email) between 3 and 254
      and email = btrim(email)
      and email !~ '\s'
      and email ~ '^[^@]+@[^@]+\.[^@]+$'
    ),

  constraint early_access_company_shape
    check (company is null or (btrim(company) <> '' and char_length(company) <= 120)),

  constraint early_access_use_case_known
    check (use_case in (
      'personal_productivity',
      'software_development',
      'ai_agents',
      'knowledge_management',
      'business_operations',
      'finance',
      'research',
      'other'
    )),

  constraint early_access_other_use_case_shape
    check (other_use_case is null
           or (btrim(other_use_case) <> '' and char_length(other_use_case) <= 2000)),

  -- Both halves matter. Without the first, 'other' is a category with no
  -- content; without the second, a stored explanation could survive a change
  -- of category and be read later as though it described it.
  constraint early_access_other_use_case_matches_use_case
    check ((use_case = 'other') = (other_use_case is not null)),

  constraint early_access_team_size_known
    check (team_size is null or team_size in ('just_me', '2_10', '11_50', '50_plus')),

  constraint early_access_challenge_shape
    check (challenge is null or (btrim(challenge) <> '' and char_length(challenge) <= 2000)),

  constraint early_access_status_known
    check (status in ('new', 'reviewing', 'invited', 'declined'))
);

comment on table access.early_access_requests is
  'Early-access submissions from the public page. Written only through public.request_early_access(); no API role holds any privilege on it.';

comment on column access.early_access_requests.status is
  'Owner triage state. Nothing in the application reads or writes it — the queue is reviewed in the database.';

-- One request per address. The function absorbs the conflict silently, so a
-- second submission is neither an error the visitor has to read nor a signal
-- that the first one exists.
create unique index if not exists early_access_requests_email_key
  on access.early_access_requests (lower(email));

create index if not exists early_access_requests_status_created_idx
  on access.early_access_requests (status, created_at desc);

-- Enabled with no policies on purpose. Combined with the absent grants this is
-- belt and braces: RLS denies by default, so any row-level access would have
-- to be added deliberately rather than inherited by accident.
alter table access.early_access_requests enable row level security;

revoke all on access.early_access_requests from public, anon, authenticated;

-- ============================================================================
-- public.request_early_access — the only way in.
--
-- SECURITY DEFINER because the caller is `anon`, who cannot see the `access`
-- schema at all. It returns void: a function that returned the new id, or a
-- boolean saying whether the insert happened, would turn the front door into
-- an oracle for "is this address already on the list".
-- ============================================================================

create or replace function public.request_early_access(
  p_name           text,
  p_email          text,
  p_use_case       text,
  p_company        text default null,
  p_other_use_case text default null,
  p_team_size      text default null,
  p_challenge      text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into access.early_access_requests (
    name, email, company, use_case, other_use_case, team_size, challenge
  )
  values (
    btrim(p_name),
    lower(btrim(p_email)),
    nullif(btrim(coalesce(p_company, '')), ''),
    p_use_case,
    nullif(btrim(coalesce(p_other_use_case, '')), ''),
    nullif(btrim(coalesce(p_team_size, '')), ''),
    nullif(btrim(coalesce(p_challenge, '')), '')
  )
  on conflict do nothing;
end;
$$;

comment on function public.request_early_access(text, text, text, text, text, text, text) is
  'Records an early-access request. Returns nothing, so it cannot be used to discover whether an address is already on the list.';

revoke all on function public.request_early_access(text, text, text, text, text, text, text)
  from public;

grant execute on function public.request_early_access(text, text, text, text, text, text, text)
  to anon, authenticated;
