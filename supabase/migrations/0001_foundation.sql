-- ============================================================================
-- ASI OS — 0001_foundation
--
-- The security spine. Three tables, and the rules that make them private.
--
-- Design rules that every future migration must also follow:
--
--   1. Every user-owned table has `user_id uuid not null references auth.users`.
--      Nullable ownership is a latent data leak, because a null owner satisfies
--      no policy and quietly accumulates unreachable rows.
--   2. RLS is enabled on every user-owned table and is the ONLY isolation
--      boundary. Application-level `where user_id = ...` filters are defence in
--      depth, never the mechanism.
--   3. Policies use `(select auth.uid())` rather than a bare `auth.uid()` so
--      PostgreSQL evaluates the current user once per statement instead of once
--      per row.
--   4. Privileges are granted per column where a column must not be
--      self-assigned (for example `profiles.is_owner`). RLS controls which rows
--      you may touch; GRANTs control which columns. Both are needed.
--   5. The service role must never be used to read or write user data. It
--      exists for migrations and administrative invitation flows only.
-- ============================================================================

-- No extensions are required. `gen_random_uuid()` has been part of core
-- PostgreSQL since version 13, so ASI OS carries no pgcrypto dependency and
-- installs nothing into the public schema.

-- ── Shared trigger helpers ──────────────────────────────────────────────────

-- `search_path` is pinned on every function so a malicious schema earlier in a
-- caller's search path cannot shadow the objects these functions resolve.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Maintains updated_at on row modification.';

-- ============================================================================
-- profiles — one row per account, created automatically on signup.
-- ============================================================================

create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null unique references auth.users (id) on delete cascade,
  display_name text,
  timezone     text not null default 'UTC',
  -- Set by the signup trigger for the first account only. Authenticated users
  -- have no UPDATE privilege on this column, so it cannot be self-granted.
  is_owner     boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint profiles_display_name_length
    check (display_name is null or char_length(display_name) between 1 and 120),
  constraint profiles_timezone_length
    check (char_length(timezone) between 1 and 64)
);

comment on table public.profiles is
  'Per-account identity. ASI never fabricates a display name; a null value means the greeting stays generic.';

-- At most one owner can exist, enforced by the database rather than by hope.
create unique index if not exists profiles_single_owner_idx
  on public.profiles (is_owner)
  where is_owner;

create index if not exists profiles_user_id_idx
  on public.profiles (user_id);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Deleting an account happens through auth.users, which cascades. There is
-- deliberately no DELETE policy or privilege on profiles.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (user_id, display_name, timezone) on public.profiles to authenticated;
grant update (display_name, timezone) on public.profiles to authenticated;

-- ============================================================================
-- user_settings — durable, RLS-protected preferences.
--
-- Kept in Postgres rather than localStorage so settings are portable,
-- exportable, auditable, and covered by the same isolation guarantees as every
-- other record. The JSONB payload is validated by a Zod schema in
-- `lib/schemas/settings.ts` on both read and write.
-- ============================================================================

create table if not exists public.user_settings (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_settings_is_object
    check (jsonb_typeof(settings) = 'object')
);

comment on table public.user_settings is
  'Durable per-user preferences. Shape is validated in application code by lib/schemas/settings.ts.';

create index if not exists user_settings_user_id_idx
  on public.user_settings (user_id);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.user_settings from anon, authenticated;
grant select on public.user_settings to authenticated;
grant insert (user_id, settings) on public.user_settings to authenticated;
grant update (settings) on public.user_settings to authenticated;

-- ============================================================================
-- activity_events — the append-only audit trail.
--
-- This table is the product's memory of what actually happened, so it is
-- append-only at BOTH levels: there is no UPDATE or DELETE policy, and no
-- UPDATE or DELETE privilege. A user can write their own history and read it
-- back; nobody can rewrite it.
--
-- `event_type` is intentionally unconstrained text. An audit write must never
-- fail because a new event type has not yet been added to a CHECK constraint —
-- losing the record is worse than storing an unrecognised label. Valid values
-- are defined and validated in `lib/schemas/activity.ts`.
-- ============================================================================

create table if not exists public.activity_events (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  event_type   text not null,
  actor        text not null default 'user',
  summary      text not null,
  subject_type text,
  subject_id   uuid,
  detail       jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),

  constraint activity_events_actor_known
    check (actor in ('user', 'agent', 'system')),
  constraint activity_events_event_type_length
    check (char_length(event_type) between 1 and 80),
  constraint activity_events_summary_length
    check (char_length(summary) between 1 and 500),
  constraint activity_events_detail_is_object
    check (jsonb_typeof(detail) = 'object')
);

comment on table public.activity_events is
  'Append-only audit trail. No UPDATE or DELETE policy or privilege exists by design.';

create index if not exists activity_events_user_occurred_idx
  on public.activity_events (user_id, occurred_at desc);

create index if not exists activity_events_user_type_idx
  on public.activity_events (user_id, event_type, occurred_at desc);

create index if not exists activity_events_subject_idx
  on public.activity_events (user_id, subject_type, subject_id)
  where subject_id is not null;

alter table public.activity_events enable row level security;

drop policy if exists "activity_events_select_own" on public.activity_events;
create policy "activity_events_select_own" on public.activity_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "activity_events_insert_own" on public.activity_events;
create policy "activity_events_insert_own" on public.activity_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

revoke all on public.activity_events from anon, authenticated;
grant select, insert on public.activity_events to authenticated;

-- ============================================================================
-- updated_at triggers
-- ============================================================================

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists user_settings_set_updated_at on public.user_settings;
create trigger user_settings_set_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Account provisioning
--
-- Runs as SECURITY DEFINER because it must insert into tables the brand-new
-- account cannot yet see. It is callable only by the trigger: EXECUTE is
-- revoked from every API-reachable role.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, is_owner)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    -- The first account to exist is the owner. The partial unique index on
    -- is_owner makes this safe under concurrency.
    not exists (select 1 from public.profiles)
  )
  on conflict (user_id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Provisions a profile and settings row on signup. Trigger-only; EXECUTE is revoked from API roles.';

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Idempotent backfill so a project seeded before this migration converges.
insert into public.profiles (user_id)
select u.id
from auth.users u
left join public.profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

insert into public.user_settings (user_id)
select u.id
from auth.users u
left join public.user_settings s on s.user_id = u.id
where s.user_id is null
on conflict (user_id) do nothing;
