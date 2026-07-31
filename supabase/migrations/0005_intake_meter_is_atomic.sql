-- ============================================================================
-- ASI OS — 0005_intake_meter_is_atomic
--
-- The meter 0004 installed counts correctly and enforces nothing.
--
-- It reads `select count(*)` and then inserts, with no lock between the two.
-- Under READ COMMITTED — which is what every PostgREST call runs at — concurrent
-- transactions cannot see each other's uncommitted attempt rows, so they all
-- read the same number and all decide they are under the limit. Measured against
-- this schema, five runs each: 40 parallel calls from one identifier with
-- `per_client_max = 5` wrote 11 to 39 rows; 100 with `per_client_max = 3` wrote 6
-- to 78; 60 parallel callers against `global_max = 10` wrote 48 to 59.
-- Sequentially the same calls stop at exactly the limit, which is why 125 passing
-- tests said nothing about it — every one of them submits on a single connection.
--
-- Two further defects share the same cause, and the same fix:
--
--   * **The ceiling never drained.** The deployment-wide window counted every
--     row in it, including the rows written *by* refusals. A caller knocking
--     faster than `global_max / global_window` therefore kept the ceiling met
--     with its own refusals, and the form stayed closed for everybody for as
--     long as the knocking continued. Filling a ceiling of three and then
--     knocking forty times left the next decision reading 43. At the shipped
--     defaults the sustaining rate is one request every eighteen seconds, which
--     the edge bucket permits three times over.
--
--   * **Counting got more expensive the more it had to count.** The global
--     `count(*)` had no bound but the window, so a flood bought the attacker
--     latency on every subsequent call. Median of 25 calls, with the table
--     vacuumed and analysed at each step so bloat is not what is being read:
--     0.59 ms at a thousand rows in the window, 1.3 ms at ten thousand, 5.6 ms
--     at a hundred thousand, 47 ms at a million. Aging the same million rows out
--     of the window returns the call to under a millisecond, so it is the number
--     of rows counted and nothing else. The plan is a parallel sequential scan,
--     so a submission also takes two parallel workers with it. Forcing the count
--     onto `intake_attempts_created_idx` makes it slower, not faster: an
--     index-only scan of a million entries is still a scan of a million entries.
--
-- ============================================================================
-- The fix: the increment *is* the decision.
--
-- One row per bucket per window, and a conditional upsert that increments it:
--
--   insert ... values (bucket, window, 1)
--   on conflict (bucket, window_start) do update
--     set admitted = c.admitted + 1
--     where c.admitted < <limit>
--   returning admitted
--
-- `ON CONFLICT DO UPDATE` takes a row lock on the conflicting row, so concurrent
-- callers queue on it and each is handed a distinct successive number. Nothing is
-- read and then acted on: the `WHERE` is evaluated against the locked row, and a
-- call that returns nothing was refused *without having incremented anything*.
-- That last property is what makes the ceiling drain again — a refusal cannot
-- become the reason for the next refusal.
--
-- An advisory lock would also have made the count atomic, and was measured
-- against this rather than argued about: correct, but 51 ms against 13 for 30
-- parallel calls from one caller, and for a deployment-wide ceiling it has to be
-- one lock shared by every caller, which serialises the whole endpoint behind a
-- count that is itself O(rows) — 259 ms against 13 with an empty table, 662
-- against 19 with 300,000 rows of history. It also fixes only the race, because
-- the cost and the lockout come from what is counted rather than from the absence
-- of a lock. The counter fixes all three, and is less code.
--
-- The cost is that the windows are now fixed rather than sliding, so a caller who
-- times it can send `per_client_max` twice across a boundary. That is the
-- standard price of a fixed window and it is a bound, not a hole; the edge token
-- bucket caps the rate at which the boundary can be exploited. It is also a price
-- this design already paid: `client_hash` includes the UTC date, so every
-- caller's bucket already reset at midnight.
--
-- See docs/DECISIONS/0010-the-meter-counts-atomically.md.
-- ============================================================================

-- ============================================================================
-- access.intake_counters — the meter, as counters rather than rows.
--
-- Replaces `access.intake_attempts`. That table recorded one row per call, which
-- is what made counting unbounded; these rows are bounded by the number of
-- buckets seen in a window, and reading one is a primary-key lookup however busy
-- the door has been.
--
-- It is also a better answer to "was there a flood last night" than the rows
-- were: `refused` is a count per bucket per window, where before it was a
-- `count(*)` over whatever had not yet been pruned.
-- ============================================================================

create table if not exists access.intake_counters (
  -- Either a caller's keyed digest, or the deployment as a whole.
  bucket        text        not null,
  -- The start of the fixed window this count belongs to, from
  -- `access.intake_window()`. Part of the key, so a new window is a new row
  -- rather than a reset of an old one — no statement anywhere lowers a count.
  window_start  timestamptz not null,
  /**
   * Calls this bucket was allowed in this window. Never rises above the limit in
   * force when it was incremented, because the limit is the increment's own
   * condition.
   */
  admitted      integer     not null default 0,
  /** Calls refused. Recorded, and deliberately not consulted by any decision. */
  refused       integer     not null default 0,

  primary key (bucket, window_start),

  -- The same privacy guarantee 0004 expressed on `client_hash`, and for the same
  -- reason: a constraint, not a convention. No address in any notation satisfies
  -- it, and the one non-digest value permitted is a word that is not hexadecimal.
  constraint intake_counters_bucket_shape
    check (bucket = 'deployment' or bucket ~ '^[0-9a-f]{32}$'),

  constraint intake_counters_counts_sane
    check (admitted >= 0 and refused >= 0)
);

comment on table access.intake_counters is
  'Rate-limit counters for the public intake form, one row per bucket per fixed window. Holds a keyed digest of the caller, never an address, and is pruned to access.intake_limits.retain_counters.';

comment on column access.intake_counters.bucket is
  'Keyed digest of the caller''s network and the UTC date, computed by the application, or the literal ''deployment'' for the whole-deployment ceiling. Constrained so an address cannot be stored here.';

comment on column access.intake_counters.admitted is
  'Incremented only when the increment itself was permitted, so this column can never exceed the threshold that admitted it.';

comment on column access.intake_counters.refused is
  'Incremented after a refusal, and read by nobody. A refusal that counted towards its own window would keep the door shut by being refused.';

-- Pruning walks this. Nothing else needs an index: every read is by primary key.
create index if not exists intake_counters_window_idx
  on access.intake_counters (window_start);

alter table access.intake_counters enable row level security;

revoke all on access.intake_counters from public, anon, authenticated;

drop table if exists access.intake_attempts;

-- ============================================================================
-- The retention column now describes counters rather than rows.
-- ============================================================================

alter table access.intake_limits
  rename column retain_attempts to retain_counters;

alter table access.intake_limits
  rename constraint intake_limits_retention_sane to intake_limits_retain_counters_sane;

comment on column access.intake_limits.retain_counters is
  'How long a window''s counters are kept. Long enough to answer "was there a flood last night", short enough that the table is not a log.';

-- ============================================================================
-- access.intake_window — which fixed window an instant belongs to.
--
-- Pure arithmetic on an instant, so it can be reasoned about on its own. STABLE
-- rather than IMMUTABLE because `extract(epoch from timestamptz)` is itself only
-- stable; nothing here depends on that, but claiming more than the functions it
-- calls would be a lie the planner is entitled to believe.
--
-- The windows `access.intake_limits` permits are bounded to between a minute and
-- seven days, all of which have an exact number of seconds; an interval measured
-- in months would not, and the CHECK constraints already exclude one.
-- ============================================================================

create or replace function access.intake_window(p_at timestamptz, p_window interval)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select to_timestamp(
    floor(extract(epoch from p_at) / extract(epoch from p_window))
      * extract(epoch from p_window)
  )
$$;

comment on function access.intake_window(timestamptz, interval) is
  'The start of the fixed window of length p_window that contains p_at. Used as part of the primary key of access.intake_counters.';

-- Unreachable already, since no API role holds USAGE on `access`. Revoked as
-- well, so a future grant on the schema does not silently hand it out.
revoke all on function access.intake_window(timestamptz, interval) from public;

-- ============================================================================
-- public.request_early_access — the same door, counting atomically.
--
-- The signature does not change, so no caller has to. What changes is that the
-- two thresholds are now enforced by the statement that records the call rather
-- than by a number read just before it, and that a submission the queue itself
-- refuses can no longer roll back the count that was spent on it.
-- ============================================================================

create or replace function public.request_early_access(
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
  v_window timestamptz;
  v_count  integer;
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

  -- Rows for windows nobody can still be inside.
  --
  -- Bounded, and taking only rows nothing else has claimed. 0004 deleted every
  -- expired row on every call, which is fine until there are a lot of them: with
  -- a million expired windows, sixty parallel callers all tried to delete the
  -- same million rows, one did it and the other fifty-nine waited — 2,288 ms for
  -- a form submission, against 78 ms this way. `limit` bounds the work and
  -- `skip locked` means concurrent callers take different batches instead of
  -- queueing for one.
  --
  -- Two rows can be created per call and two hundred are removed, so this keeps
  -- up with a hundred times the traffic that fills it. A backlog left by a flood
  -- drains over the calls that follow and costs nothing but disk while it does,
  -- because every read of this table is by primary key.
  delete from access.intake_counters as c
   using (
     select bucket, window_start
       from access.intake_counters
      where window_start < now() - v_limits.retain_counters
      order by window_start
      limit 200
      for update skip locked
   ) as expired
   where c.bucket = expired.bucket
     and c.window_start = expired.window_start;

  -- ── The caller's own budget ───────────────────────────────────────────────
  v_window := access.intake_window(now(), v_limits.per_client_window);

  insert into access.intake_counters as c (bucket, window_start, admitted)
  values (v_client, v_window, 1)
  on conflict (bucket, window_start) do update
    set admitted = c.admitted + 1
    where c.admitted < v_limits.per_client_max
  returning c.admitted into v_count;

  if v_count is null then
    update access.intake_counters
       set refused = refused + 1
     where bucket = v_client and window_start = v_window;
    return 'throttled';
  end if;

  -- ── The deployment's budget ───────────────────────────────────────────────
  -- Checked second, so a caller already over their own limit never spends any of
  -- it. The caller's increment above stands either way: they did make a request.
  v_window := access.intake_window(now(), v_limits.global_window);

  insert into access.intake_counters as c (bucket, window_start, admitted)
  values ('deployment', v_window, 1)
  on conflict (bucket, window_start) do update
    set admitted = c.admitted + 1
    where c.admitted < v_limits.global_max
  returning c.admitted into v_count;

  if v_count is null then
    update access.intake_counters
       set refused = refused + 1
     where bucket = 'deployment' and window_start = v_window;
    return 'throttled';
  end if;

  -- ── The submission ───────────────────────────────────────────────────────
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
  exception
    -- Without this the counters spent above would roll back with the failed
    -- insert, and a caller able to produce a submission this table refuses would
    -- have an unlimited number of free requests. A NUL byte in a name is enough:
    -- it passes the Zod schema and PostgreSQL cannot store it.
    --
    -- Only the two classes a submission can cause are caught — malformed data and
    -- a violated constraint. A lock timeout or a failure to write is not
    -- something to answer 'failed' about and carry on from.
    when data_exception or integrity_constraint_violation then
      -- The code, never SQLERRM: a constraint violation is entitled to quote the
      -- row that caused it, and that row is somebody's answers. This is the one
      -- place the reason survives, since answering rather than raising is what
      -- keeps the count and also what hides the code from the caller.
      raise warning 'request_early_access: the queue refused a submission (SQLSTATE %)', sqlstate;
      return 'failed';
  end;

  return 'accepted';
end;
$$;

comment on function public.request_early_access(text, text, text, text, text, text, text, text, text) is
  'Records an early-access request for a recognised caller within the configured limits. Both limits are enforced by the statement that counts the call, so concurrent callers cannot exceed them. Returns accepted, throttled, refused, unconfigured or failed — never anything that distinguishes a new address from one already on the list.';

revoke all on function public.request_early_access(text, text, text, text, text, text, text, text, text)
  from public;

grant execute on function public.request_early_access(text, text, text, text, text, text, text, text, text)
  to anon, authenticated;
