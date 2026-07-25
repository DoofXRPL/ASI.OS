-- ============================================================================
-- Supabase `auth` contract shim — TEST FIXTURE ONLY.
--
-- This file is NEVER applied to a real Supabase project. It lives under
-- `tests/` precisely so it can never be mistaken for a migration.
--
-- Purpose: let the Row Level Security suite run against a plain PostgreSQL
-- database. It recreates the small part of Supabase's surface that our policies
-- actually depend on:
--
--   * the `anon`, `authenticated` and `service_role` roles
--   * `auth.users`, with the `raw_user_meta_data` column the signup trigger reads
--   * `auth.uid()`, which resolves the caller from the `request.jwt.claims`
--     setting exactly as Supabase's own implementation does
--
-- Because `auth.uid()` here reads the same setting through the same mechanism as
-- production, a policy that isolates users against this shim isolates users
-- against Supabase. What is being tested is the policy, not the shim.
-- ============================================================================

create schema if not exists auth;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

-- Mirrors Supabase: the current user is whatever the request's JWT claims say.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    ''
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  )::text
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

grant execute on function auth.uid(), auth.role(), auth.jwt()
  to anon, authenticated, service_role;
