# Building the Odyssey revamp in Cursor

How to actually drive `docs/ODYSSEY-BLUEPRINT.md` from Cursor without the agent
drifting, inventing, or arguing with the repository's own documentation.

---

## 1. The mechanism is the repo, not the prompt

The most common failure with a codebase like this one is a beautiful prompt typed
into a chat window that the agent forgets by file six. This repository is unusual
in that it already documents its own constraints extremely well — so the leverage
is not in writing longer prompts, it is in making sure the agent **reads the right
four files every single time**.

That is what `.cursor/rules/` is for. Those files are attached to every request
automatically. The prompts in §4 are short precisely because the rules carry the
context.

**Order of operations, once per session:**

1. Open the repo on branch `claude/pewdiepie-odyssey-revamp-su2v4c`.
2. Confirm `.cursor/rules/` is present (it is committed).
3. Use **Plan mode** for the milestone, **Agent mode** for each task.
4. One task per conversation. Start a new chat when the task changes.

---

## 2. Which model, for what

Pick the current equivalent if these names have moved on — the classes matter more
than the labels.

| Work | Model | Mode | Why |
| --- | --- | --- | --- |
| Phase A1–A5 (rewriting principles, ADRs) | **Claude Opus, Max mode** | Plan → Agent | These are judgement documents that have to reconcile with ~3,000 lines of existing prose without contradicting it. Long context and careful reading matter far more than speed. Do not cheap out here; everything downstream inherits it. |
| Migrations + RLS tests (B2, B3, D, E) | **Claude Opus** | Agent | SQL where a subtle mistake is a data leak, against a test suite that enumerates the schema. Worth the tokens. |
| `lib/ai/`, `lib/tools/`, route handlers | **Claude Sonnet** | Agent | Well-specified by the blueprint. Sonnet is fine and about four times cheaper. Escalate to Opus if it stalls twice. |
| Components, layout, styling (C, most of B5) | **Claude Sonnet** | Agent | Tight feedback loop, you can see the result. |
| Mechanical multi-file refactors | **Composer** | Agent | Fast, and the blast radius is visible in the diff. |
| "What does this do / where is X" | **Ask mode**, any model | Ask | Never let Agent mode loose to answer a question; it will start editing. |

**Turn Auto off** for this project. Auto picks cheap models for tasks whose cost
is a silent RLS mistake.

**Max mode / long context**: on for A1–A5 and for any task touching more than six
files. Off otherwise — it makes the model slower and more prone to wandering.

---

## 3. The loop for every single task

```
1. Plan mode:  paste the task prompt. Read the plan. Argue with it.
2. Agent mode: "Implement the plan above." 
3. Terminal:   npm run verify
4. Fix, or revert and re-plan. Do not let the agent "fix" verify by weakening a test.
5. git commit -m "..."   (one task, one commit)
6. New chat for the next task.
```

`npm run verify` runs typecheck → lint → guard:service-role → unit → RLS → build,
in CI's order. RLS needs `TEST_DATABASE_URL`; see `AGENTS.md`. **A task is not done
until verify is green**, and the single most valuable habit in this repo is
refusing the agent's offer to skip that.

---

## 4. Prompts

### 4.1 Session kickoff — paste this first, once

```
Read these four files completely before doing anything else:

  docs/ODYSSEY-BLUEPRINT.md
  docs/PRINCIPLES.md
  AGENTS.md
  docs/AUDIT-2026-08-03.md

Then answer three questions and stop:

1. In two sentences, what is the revamp changing and what is it deliberately
   keeping?
2. Which documents in this repo currently contradict the blueprint, by file
   and section?
3. What is Phase A task 1, and why does it come before any code?

Do not write or edit any file yet.
```

If the answers are wrong, the rules are not loading. Fix that before continuing;
everything after this depends on it.

### 4.2 The task template — use this for every task

```
Task <ID> from docs/ODYSSEY-BLUEPRINT.md §8.

Objective:  <one sentence, copied from the roadmap table>
Files:      <the exact files you expect to change>
Out of scope: <name the adjacent thing you do NOT want touched>

Constraints:
- Every hard rule in AGENTS.md applies. If this task requires breaking one,
  stop and tell me which one instead of breaking it.
- New table => user_id not null, RLS, owner-scoped policy, composite unique on
  (id, user_id), and RLS tests, in the same commit.
- No fabricated data, no placeholder values, no "coming soon". Use the states
  in components/os/states.tsx.
- A read that fails returns ReadResult and renders Failed. A write that changes
  nothing returns { ok: false }.
- Do not add a dependency without telling me first and saying why.

Done when: <the observable outcome, not "the code is written">

Plan first. Do not edit anything until I approve the plan.
```

### 4.3 Phase A task 1 — the one that unblocks everything

This is the highest-stakes prompt in the project. Use Opus, Max mode, Plan first.

```
Task A1 from docs/ODYSSEY-BLUEPRINT.md §8.

The repository's own documentation currently forbids the product we are now
building. Rewrite it so the constraints that still matter are preserved and
sharpened, and the ones that describe a product we are no longer building are
removed with their reasoning intact.

Files: docs/PRINCIPLES.md, AGENTS.md, docs/IMPLEMENTATION_PLAN.md (§3, §4,
§15-§18), README.md (the "Current state" section).

KEEP, and strengthen where the revamp gives them more work to do:
- PRINCIPLES §2  never fabricate  -> gains teeth: model claims whose evidence
  does not resolve to a row the caller owns are not shown.
- PRINCIPLES §5  the human keeps control -> the server registry decides what
  needs approval; the model's own flag is advisory and ignored.
- PRINCIPLES §6  memory is visible, sourced, editable, forgettable.
- PRINCIPLES §7  RLS is the only isolation boundary.
- PRINCIPLES §9  progressive disclosure.
- PRINCIPLES §10 structure only when real use earns it.
- PRINCIPLES §11 calm by default; colour carries meaning.
- Every hard rule in AGENTS.md 1-14.

REPLACE:
- PRINCIPLES §1 "the loop is the product" and §4 "navigation earns its place".
  The loop still exists but chat is now the front door, and the nav will carry
  surfaces that are built in phases. Rewrite both so they say what is now true
  without becoming permissive: a surface still ships only when it is real.
- AGENTS.md "What this product is" and "Current state".
- IMPLEMENTATION_PLAN §3 non-goals ("no general-purpose chatbot as the primary
  surface", "no agent zoo", "no MCP", "no mobile app"), §4 ("No chat box until
  Phase 4"), and the §15-§18 phase list, which docs/ODYSSEY-BLUEPRINT.md now
  supersedes.

RULES FOR THE REWRITE:
- Match the existing voice exactly: declarative, reasoned, no marketing, no
  hype, no exclamation, sentences that say why and not just what.
- Do not delete reasoning. Where a decision is reversed, say what it was and
  why it changed. Preserved history is the point of these documents.
- IMPLEMENTATION_PLAN keeps its history. Mark superseded sections as
  superseded, with a pointer to the blueprint. Do not silently rewrite it into
  agreement.
- Do not touch any file under app/, lib/, components/, supabase/ or tests/.
  This task changes prose only.

Done when: npm run verify is green, and no document in the repo argues against
docs/ODYSSEY-BLUEPRINT.md.

Plan first. Show me the diff outline before you write.
```

### 4.4 The prompt for anything touching the database

Append this to the task template for B2, B3, D and E:

```
Additional constraints for schema work:

- Follow supabase/migrations/0005_intake_meter_is_atomic.sql as the model for
  any counter or limit: a conditional upsert whose WHERE clause IS the
  decision. Never read-then-write.
- Follow the composite foreign key pattern already in
  0002_capture_and_projects.sql: the FK includes user_id, so referencing
  another account's row fails identically to referencing a row that does not
  exist.
- Column-level grants where immutability matters, the way inbox_items.content
  already does it. Immutability enforced by privilege, never by application
  code.
- tests/rls/isolation.test.ts enumerates schemas and tables and asserts the
  expected set. Update it in the same commit; a new table without tests is
  meant to fail CI.
- Add a concurrency test modelled on tests/rls/intake-concurrency.test.ts if
  this migration introduces a limit.
- Update lib/supabase/database.types.ts using TYPE ALIASES, not interfaces.
  See AGENTS.md hard rule 7 for why interfaces silently break every query.
```

### 4.5 When the agent goes wrong

| Symptom | Say this |
| --- | --- |
| It invents a placeholder or sample value | `AGENTS.md hard rule 4. There is deliberately no component for a fake value. Use components/os/states.tsx and pick the honest state.` |
| It adds a dependency you did not approve | `Revert that. Name the problem it solves and the evidence the problem exists — PRINCIPLES §10 — then ask me.` |
| It "fixes" a failing test by changing the test | `The test is the specification. Revert the test and fix the code, or tell me the specification is wrong and why.` |
| It builds an empty shell for a later phase | `Not in this phase. Read docs/ODYSSEY-BLUEPRINT.md §8 and tell me which phase this belongs to.` |
| It writes a Supabase client directly | `AGENTS.md hard rules 1 and 2. Use lib/supabase/server.ts. npm run guard:service-role will fail this anyway.` |
| It sprawls across twenty files | Stop it. The task was too big. Split it and start a new chat. |

---

## 5. Things worth wiring up once

- **Background agents** for Phase A6–A9 (the audit fixes). They are small,
  independent, well-specified, and each one is a clean revert if it goes wrong —
  which is exactly the profile that suits an agent you are not watching.
- **A `verify` run configuration** so it is one click, not a remembered command.
  The friction of typing it is the reason people stop running it.
- **Keep `docs/ODYSSEY-BLUEPRINT.md` open in a tab** and pinned as context on
  planning conversations. It is the only file that knows the whole shape.
- **Update the blueprint when reality diverges from it.** A plan document that
  quietly stops being true is worse than no plan — the audit says exactly this
  about `IMPLEMENTATION_PLAN.md` §6/§7, and it will be just as true of this one.
</content>
