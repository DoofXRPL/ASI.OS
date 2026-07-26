-- ============================================================================
-- ASI OS — 0002_capture_and_projects
--
-- The first records that describe work rather than the system itself.
--
--   projects     — what you are trying to make true, and what moves it forward
--   inbox_items  — captured input, preserved exactly as it was written
--
-- Every rule from 0001_foundation applies here unchanged: non-nullable
-- ownership, RLS as the only isolation boundary, `(select auth.uid())` in every
-- policy, per-column grants where a column must not be self-assigned, and no
-- privileged credential anywhere in application code.
--
-- Two rules are specific to this migration:
--
--   A. A capture cannot be rewritten. `inbox_items.content` carries no UPDATE
--      privilege, so "the original input is preserved" is enforced by the
--      database rather than promised by the interface.
--   B. Nothing here can be deleted. Projects are abandoned and captures are
--      archived. Losing the record of what you were trying to do would
--      contradict the Remember stage of the loop.
-- ============================================================================

-- ============================================================================
-- projects — an intended outcome and the single action that moves it forward.
-- ============================================================================

create table if not exists public.projects (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  name            text not null,
  outcome         text,
  status          text not null default 'active',
  next_action     text,
  blocked_reason  text,
  -- Written explicitly by the application when a human changes something, never
  -- by a trigger. "Recently touched" must mean a person did something, not that
  -- a bookkeeping write happened to run.
  last_touched_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Blank is not a value. Without these, "no next action" would have two
  -- representations — null and '' — and the interface would eventually
  -- disagree with itself about which means nothing.
  constraint projects_name_shape
    check (char_length(name) between 1 and 120 and btrim(name) <> ''),
  constraint projects_outcome_shape
    check (outcome is null or (btrim(outcome) <> '' and char_length(outcome) <= 2000)),
  constraint projects_next_action_shape
    check (next_action is null or (btrim(next_action) <> '' and char_length(next_action) <= 280)),
  constraint projects_blocked_reason_shape
    check (blocked_reason is null or (btrim(blocked_reason) <> '' and char_length(blocked_reason) <= 500)),

  constraint projects_status_known
    check (status in ('active', 'paused', 'blocked', 'done', 'abandoned')),

  -- A blocked project must say why, and only a blocked project may carry a
  -- reason. Both halves matter: an unexplained blocker is not actionable, and a
  -- reason left behind after unblocking is a stale sentence waiting to be
  -- rendered as if it were current.
  constraint projects_blocked_reason_matches_status
    check ((status = 'blocked') = (blocked_reason is not null)),

  -- The target of the composite foreign key on inbox_items below. `id` is
  -- already unique; this pair exists so a capture can only ever reference a
  -- project belonging to the same account.
  constraint projects_user_id_id_key unique (user_id, id)
);

comment on table public.projects is
  'An intended outcome, its status, and the one action that moves it forward. Deliberately not deletable: abandonment is a status.';

comment on column public.projects.last_touched_at is
  'Set by the application on user-initiated change only, so "recently active" reflects a person rather than a background write.';

create index if not exists projects_user_touched_idx
  on public.projects (user_id, last_touched_at desc);

create index if not exists projects_user_status_idx
  on public.projects (user_id, status);

alter table public.projects enable row level security;

drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own" on public.projects
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own" on public.projects
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own" on public.projects
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- No DELETE policy and no DELETE privilege. Accounts are removed through
-- auth.users, which cascades.
revoke all on public.projects from anon, authenticated;
grant select on public.projects to authenticated;
grant insert (user_id, name, outcome, status, next_action, blocked_reason)
  on public.projects to authenticated;
grant update (name, outcome, status, next_action, blocked_reason, last_touched_at)
  on public.projects to authenticated;

-- ============================================================================
-- inbox_items — captured input, preserved exactly as written.
--
-- Capture must cost nothing: one field, no required metadata, no decision about
-- where it belongs. Classification happens later, and never edits the original.
-- ============================================================================

create table if not exists public.inbox_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  content        text not null,
  -- Null until you say. Capture must cost nothing, and defaulting to "note"
  -- would be ASI classifying your input on your behalf and then displaying that
  -- guess back to you as though you had made it.
  kind           text,
  status         text not null default 'unprocessed',
  project_id     uuid,
  processed_into text,
  processed_at   timestamptz,
  -- Only the person using ASI can capture today. The column exists because the
  -- distinction will matter once something else can write here, and it is not
  -- grantable, so nothing can claim an origin it does not have.
  source         text not null default 'manual',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint inbox_items_content_shape
    check (char_length(content) between 1 and 4000 and btrim(content) <> ''),
  constraint inbox_items_kind_known
    check (kind is null or kind in ('note', 'task', 'idea', 'question', 'link')),
  constraint inbox_items_status_known
    check (status in ('unprocessed', 'processed', 'archived')),
  constraint inbox_items_processed_into_known
    check (processed_into is null
           or processed_into in ('project', 'project_next_action', 'project_material', 'archived')),
  constraint inbox_items_source_known
    check (source in ('manual')),

  -- "Processed" can never mean nothing: leaving the queue requires both a time
  -- and a route, and staying in it forbids either.
  constraint inbox_items_processing_consistent
    check (
      (status = 'unprocessed' and processed_at is null and processed_into is null)
      or (status <> 'unprocessed' and processed_at is not null and processed_into is not null)
    ),

  -- A route that names a project must actually reference one.
  constraint inbox_items_project_route_needs_project
    check (processed_into is null
           or processed_into = 'archived'
           or project_id is not null),

  -- Composite, and this is the point of it. A plain `project_id` foreign key is
  -- checked outside Row Level Security, so it would happily link a capture to
  -- another account's project and would leak whether an id exists at all
  -- through the difference between success and a constraint violation.
  -- Including user_id makes both impossible in the database.
  --
  -- MATCH SIMPLE (the default) skips the check when project_id is null, which
  -- is exactly right for an unlinked capture. ON DELETE CASCADE is unreachable
  -- except through account deletion, since projects carry no DELETE privilege.
  constraint inbox_items_owner_project_fk
    foreign key (user_id, project_id)
    references public.projects (user_id, id)
    on update cascade
    on delete cascade
);

comment on table public.inbox_items is
  'Captured input. `content` carries no UPDATE privilege, so the original text cannot be rewritten by anyone, including its author.';

comment on column public.inbox_items.project_id is
  'Linked through a composite foreign key on (user_id, project_id), so a capture can only ever reference a project owned by the same account.';

create index if not exists inbox_items_user_status_created_idx
  on public.inbox_items (user_id, status, created_at desc);

create index if not exists inbox_items_user_project_idx
  on public.inbox_items (user_id, project_id)
  where project_id is not null;

alter table public.inbox_items enable row level security;

drop policy if exists "inbox_items_select_own" on public.inbox_items;
create policy "inbox_items_select_own" on public.inbox_items
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "inbox_items_insert_own" on public.inbox_items;
create policy "inbox_items_insert_own" on public.inbox_items
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "inbox_items_update_own" on public.inbox_items;
create policy "inbox_items_update_own" on public.inbox_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- `content` and `source` are absent from the UPDATE grant on purpose: the text
-- you captured is not editable, and its origin is not claimable. There is no
-- DELETE privilege either — an unwanted capture is archived, which keeps the
-- record of having thought it.
revoke all on public.inbox_items from anon, authenticated;
grant select on public.inbox_items to authenticated;
grant insert (user_id, content, kind, project_id) on public.inbox_items to authenticated;
grant update (kind, status, project_id, processed_into, processed_at)
  on public.inbox_items to authenticated;

-- ============================================================================
-- updated_at triggers
-- ============================================================================

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists inbox_items_set_updated_at on public.inbox_items;
create trigger inbox_items_set_updated_at
  before update on public.inbox_items
  for each row execute function public.set_updated_at();
