# 0003 — A project holds its next action; there is no task table yet

- **Status:** Accepted
- **Date:** 2026-07-25
- **Applies from:** Phase 1

## Context

The approved plan lists `tasks` alongside `projects` in Phase 1, with
`project_id`, `status`, `due_at`, `blocked_reason` and `blocked_by_task_id`.

The question this phase had to answer first was narrower: can a project say what
moves it forward? Everything Today derives depends on that one sentence
existing or not existing. A task table answers a different question — how work
is broken down — and answering it costs three more enum columns, a due date and
the whole language of lateness that comes with one.

Due dates in particular are not free. The moment a row can be overdue, an
interface starts describing things as late, and the plan's own rule is that
elapsed time is a fact while lateness is a judgement about a commitment the
system has to be sure was actually made.

## Decision

Phase 1 ships `projects.next_action` — one line of text, nullable — and
`projects.blocked_reason`. There is no `tasks` table.

A project therefore answers "what moves this forward?" with a sentence the
person wrote, and "what is in the way?" with another. Both are nullable, and
their absence is meaningful: a project with no next action is exactly the thing
Today raises.

An inbox capture can be promoted into a next action, which is the only
conversion that path needs today.

## Consequences

- Today's derivation has four rules instead of a dozen, all of them expressible
  as pure functions over two tables and all of them exhaustively tested.
- Nothing in the product can be overdue, because nothing has a due date. The
  only time-based signal is elapsed inactivity, stated as elapsed time.
- Work cannot be broken into steps yet. For a single person tracking a handful
  of projects, the next action is the step that matters; for anything larger,
  this will need revisiting, and that is the trigger condition for adding tasks.
- Adding `tasks` later is additive: a task table would reference `projects`,
  and `next_action` can either remain as the chosen focus or become a
  denormalised pointer at one. Nothing here has to be undone.
