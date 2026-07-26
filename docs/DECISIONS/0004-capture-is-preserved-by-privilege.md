# 0004 — Captured text is preserved by privilege, not by convention

- **Status:** Accepted
- **Date:** 2026-07-25
- **Applies from:** Phase 1

## Context

The inbox makes one promise: what you write is what is kept. Everything else
about it — classification, linking, archiving — happens afterwards and must not
disturb that.

An application can keep such a promise by simply never calling update on the
column. That works exactly as long as nobody writes the function that does,
which is a property of the team rather than of the system. The same reasoning
already applies to `activity_events`, where append-only is enforced by there
being no UPDATE policy and no UPDATE privilege, and where the TypeScript type
makes `.update()` a compile error.

## Decision

`inbox_items.content` is not included in the UPDATE grant to `authenticated`.
Neither is `inbox_items.source`.

The columns that carry classification and processing — `kind`, `status`,
`project_id`, `processed_into`, `processed_at` — are granted normally.

Neither `inbox_items` nor `projects` grants DELETE to anyone. A capture is
archived and a project is abandoned; both remain readable afterwards.

The application types mirror the grants, so `Update` for `inbox_items` admits
no `content` key and an attempt to edit one does not compile.

## Consequences

- "The original input is preserved" is a property of the database, provable
  against real policies with a real account. `tests/rls/work-isolation.test.ts`
  asserts both the missing privilege and the rejected statement, paired with a
  positive control showing that classification around the text still changes.
- A typo in a capture is permanent. This is a real cost and a deliberate one:
  the value of an inbox comes from trusting it to hold exactly what was thought,
  and an editable record of a thought is a record of the last edit instead. The
  refined version of a thought belongs in the project it becomes.
- Nothing accumulates silently. Archived captures and abandoned projects stay
  visible, which keeps the Remember stage of the loop honest — the decision not
  to pursue something is itself part of the record.
- If editing a capture is ever genuinely needed, the honest form is a new row
  that supersedes the old one with the correction visible, exactly as memory
  corrections are specified to work in Phase 3. It is not a grant change.
