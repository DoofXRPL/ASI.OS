-- ============================================================================
-- ASI OS — 0004_intake_guard
--
-- The front door gets a lock and a meter.
--
-- 0003 made the intake queue unreachable except through
-- `public.request_early_access()`, and then granted EXECUTE on that function to
-- `anon`. That was correct as far as it went, but it left the one thing an
-- anonymous write always leaves: the function is reachable by anybody holding
-- the publishable key, and the publishable key is published. Everything the
-- Server Action does before calling it — the honeypot, the Zod schema, the body
-- size limit — protects a path an attacker does not have to take. They can post
-- straight to `/rest/v1/rpc/request_early_access` instead.
--
-- Two changes close that, and both live here rather than in the application,
-- because a rule enforced in the application is a rule enforced on the path
-- that was already being taken:
--
--   1. **A shared key.** The function now requires `p_key`, whose SHA-256 must
--      match a row in `access.intake_keys`. The digest is all the database
--      keeps, and the key itself exists only as `ASI_INTAKE_KEY` in the
--      deployment's environment. The publishable key alone therefore buys
--      nothing: it can still address the function, and the function refuses.
--
--      This is not a privileged credential and must never become one. It grants
--      exactly one capability — call this one insert-only function — and it can
--      read nothing, so it is not the service-role key by another name.
--
--   2. **A meter.** Every call records one row in `access.intake_attempts`
--      against a hashed client identifier, and a call is refused once that
--      identifier, or the deployment as a whole, has exceeded the thresholds in
--      `access.intake_limits`. The counters live in PostgreSQL because that is
--      the only store this product has; adding a second one to hold five
--      integers would be new infrastructure bought with no evidence
--      (Principle 10).
--
-- `access.intake_attempts` holds no IP address. The check constraint on
-- `client_hash` accepts nothing but 32 hexadecimal characters, so a raw address
-- cannot be written there even by mistake — the constraint, not the calling
-- code, is what makes that a guarantee.
--
-- See docs/DECISIONS/0009-the-front-door-is-gated-and-metered.md and
-- docs/SECURITY.md.
-- ============================================================================

-- ============================================================================
-- access.intake_keys — which callers the front door recognises.
--
-- One row per key, holding only its digest. Several unretired rows may exist at
-- once, which is what makes rotation a deploy rather than an outage: add the new
-- digest, ship the new environment variable, then set `retired_at` on the old
-- row.
--
-- An empty table means no caller is recognised and every request is refused.
-- That is the intended state of a deployment that has not been configured: the
-- page then says requests are not being recorded, which is true, rather than
-- accepting submissions nothing will read.
-- ============================================================================

create table if not exists access.intake_keys (
  id          uuid primary key default gen_random_uuid(),
  -- Says which deployment or rotation the digest belongs to, so retiring one is
  -- not guesswork. Never the key, or any part of it.
  label       text not null,
  key_sha256  bytea not null unique,
  created_at  timestamptz not null default now(),
  retired_at  timestamptz,

  constraint intake_keys_label_shape
    check (char_length(label) between 1 and 60 and btrim(label) <> ''),

  constraint intake_keys_digest_shape
    check (octet_length(key_sha256) = 32)
);

comment on table access.intake_keys is
  'SHA-256 digests of the keys permitted to call public.request_early_access(). The keys themselves live only in deployment environments; an empty table refuses every request.';

comment on column access.intake_keys.retired_at is
  'Set to withdraw a key without deleting the record of it having existed. A retired key is refused.';

alter table access.intake_keys enable row level security;

revoke all on access.intake_keys from public, anon, authenticated;

-- ============================================================================
-- access.intake_limits — the thresholds, as data.
--
-- A single row, so the owner can retune the front door with an UPDATE instead of
-- a deployment. Every column is bounded: a limiter that can be configured to
-- zero is a way to take the form offline by accident, and one that can be
-- configured to a million is not a limiter.
-- ============================================================================

create table if not exists access.intake_limits (
  id                 boolean primary key default true,
  per_client_max     integer  not null default 5,
  per_client_window  interval not null default interval '15 minutes',
  global_max         integer  not null default 200,
  global_window      interval not null default interval '1 hour',
  -- How long an attempt is remembered. Long enough to answer "was there a
  -- flood last night", short enough that the table is not a log.
  retain_attempts    interval not null default interval '24 hours',

  constraint intake_limits_singleton check (id),

  constraint intake_limits_per_client_sane
    check (per_client_max between 1 and 1000),
  constraint intake_limits_global_sane
    check (global_max between 1 and 100000),
  constraint intake_limits_windows_sane
    check (per_client_window between interval '1 minute' and interval '7 days'
           and global_window between interval '1 minute' and interval '7 days'),
  constraint intake_limits_retention_sane
    check (retain_attempts between interval '1 hour' and interval '30 days')
);

comment on table access.intake_limits is
  'The one row of thresholds public.request_early_access() enforces. Tuned with an UPDATE; no deployment required.';

insert into access.intake_limits (id) values (true) on conflict do nothing;

alter table access.intake_limits enable row level security;

revoke all on access.intake_limits from public, anon, authenticated;

-- ============================================================================
-- access.intake_attempts — the meter, and the only record of abuse.
--
-- One row per call that got past the key check. `client_hash` is a keyed digest
-- computed by the application from the client address and the current UTC date;
-- the address itself is never sent here and could not be stored if it were.
-- Because the date is part of the input, yesterday's rows cannot be matched
-- against today's, so a retained row identifies a bucket rather than a person.
-- ============================================================================

create table if not exists access.intake_attempts (
  id          uuid primary key default gen_random_uuid(),
  client_hash text not null,
  outcome     text not null,
  created_at  timestamptz not null default now(),

  -- The privacy guarantee, expressed as a constraint rather than a convention.
  -- No IP address, in any notation, can satisfy this.
  constraint intake_attempts_client_hash_shape
    check (client_hash ~ '^[0-9a-f]{32}$'),

  constraint intake_attempts_outcome_known
    check (outcome in ('accepted', 'throttled'))
);

comment on table access.intake_attempts is
  'Rate-limit counters for the public intake form. Holds a keyed digest of the caller, never an address, and is pruned to access.intake_limits.retain_attempts.';

comment on column access.intake_attempts.client_hash is
  'Keyed digest of the client address and the UTC date, computed by the application. Constrained to 32 hex characters so an address cannot be stored here.';

create index if not exists intake_attempts_client_idx
  on access.intake_attempts (client_hash, created_at desc);

create index if not exists intake_attempts_created_idx
  on access.intake_attempts (created_at desc);

alter table access.intake_attempts enable row level security;

revoke all on access.intake_attempts from public, anon, authenticated;

-- ============================================================================
-- public.request_early_access — same door, now locked and metered.
--
-- The signature changes, so the old one is dropped rather than replaced: two
-- overloads would leave the unguarded one reachable, which is the entire
-- problem this migration exists to solve. PostgREST resolves a function by the
-- arguments it is given, so a caller who omits `p_key` and `p_client` does not
-- find a laxer version of this function — they find nothing.
--
-- It now returns an outcome instead of void. That does not reintroduce the
-- oracle 0003 was careful to avoid: `accepted` is returned both when a row is
-- inserted and when a duplicate address is absorbed, so the answer still says
-- nothing about whether an address is already on the list. What it does say is
-- which of the three things happened that the visitor deserves to be told
-- apart: recorded, rate limited, or not configured.
-- ============================================================================

drop function if exists public.request_early_access(text, text, text, text, text, text, text);

create or replace function public.request_early_access(
  -- Required, and first, because a submission that cannot prove where it came
  -- from is not a submission this function will consider.
  p_key            text,
  p_client         text,
  p_name           text,
  p_email          text,
  p_use_case       text,
  p_company        text default null,
  p_other_use_case text default null,
  p_team_size      text default null,
  p_challenge      text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limits access.intake_limits;
  v_client text := lower(btrim(coalesce(p_client, '')));
  v_seen   integer;
begin
  -- Checked before the key, because a caller who cannot be metered must not be
  -- served even with the right key: an unmeterable request is an unlimited one.
  if v_client !~ '^[0-9a-f]{32}$' then
    return 'refused';
  end if;

  select * into v_limits from access.intake_limits where id;
  if not found then
    return 'unconfigured';
  end if;

  if not exists (select 1 from access.intake_keys where retired_at is null) then
    return 'unconfigured';
  end if;

  -- `sha256` and `convert_to` are core PostgreSQL, so this adds no extension.
  -- Comparing digests rather than keys means the database never holds anything
  -- that could be replayed against it.
  if not exists (
    select 1
    from access.intake_keys
    where retired_at is null
      and key_sha256 = sha256(
            convert_to(coalesce(p_key, ''), 'utf8')
          )
  ) then
    return 'refused';
  end if;

  delete from access.intake_attempts
   where created_at < now() - v_limits.retain_attempts;

  -- Refusals count towards the window as well as acceptances. A caller who
  -- keeps knocking after being told to stop is the one case where extending the
  -- wait is the correct answer.
  select count(*) into v_seen
    from access.intake_attempts
   where client_hash = v_client
     and created_at > now() - v_limits.per_client_window;

  if v_seen >= v_limits.per_client_max then
    insert into access.intake_attempts (client_hash, outcome)
    values (v_client, 'throttled');
    return 'throttled';
  end if;

  select count(*) into v_seen
    from access.intake_attempts
   where created_at > now() - v_limits.global_window;

  if v_seen >= v_limits.global_max then
    insert into access.intake_attempts (client_hash, outcome)
    values (v_client, 'throttled');
    return 'throttled';
  end if;

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

  insert into access.intake_attempts (client_hash, outcome)
  values (v_client, 'accepted');

  return 'accepted';
end;
$$;

comment on function public.request_early_access(text, text, text, text, text, text, text, text, text) is
  'Records an early-access request for a recognised caller within the configured limits. Returns accepted, throttled, refused or unconfigured — never anything that distinguishes a new address from one already on the list.';

revoke all on function public.request_early_access(text, text, text, text, text, text, text, text, text)
  from public;

grant execute on function public.request_early_access(text, text, text, text, text, text, text, text, text)
  to anon, authenticated;
