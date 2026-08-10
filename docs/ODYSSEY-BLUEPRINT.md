# ASI OS — the Odyssey revamp

The blueprint for turning ASI OS from a manual system of record into a private AI
workspace, in the shape of [Odysseus](https://github.com/pewdiepie-archdaemon/odysseus)
but on the spine this repository already has.

Written 2026-08-10 against commit `c1bea81`. This is the plan of record for the
revamp and it supersedes `docs/IMPLEMENTATION_PLAN.md` §3–§4 and §15–§18 where the
two disagree. `docs/AUDIT-2026-08-03.md` remains accurate about what is built and
what is broken; its milestones M1–M9 are folded into Phase A below.

---

## 0. The decision, in one paragraph

Odysseus is capability-maximal: chat, agents, shell access, deep research, email,
calendar, image generation, a model cookbook, all self-hosted on your own GPUs,
and its trust argument is *the weights never leave your house*. ASI OS is
trust-maximal: five tables, Row Level Security as the only boundary, an
append-only audit trail, 132 RLS tests, and an explicit rule that nothing on any
surface may be fabricated. Its trust argument is *nothing here can lie to you*.

The revamp is **not** "make ASI OS look like Odysseus." It is: take Odysseus's
product shape — a workspace you live in, chat as the front door, agents that do
real work — and run it on ASI OS's spine. The result is the one thing Odysseus
structurally cannot be: **a chat that writes to a record you own, where every
action the model takes is typed, owned, approved and auditable.**

In Odysseus, chat is a chat and notes are notes and they barely know about each
other. Here, a conversation is an instrument: it captures, it creates projects,
it sets next actions, it proposes memory, and every one of those writes lands in
the same tables the manual surfaces read from, through the same RLS policies,
with the same audit trail. That is the product.

### The four decisions this plan is built on

| Decision | Choice | Consequence |
| --- | --- | --- |
| Inference | Cloud API models only | Vercel + Supabase stays. Works on any phone, anywhere, with no rig and no tunnel. No Cookbook, no local model serving, no GPU features. |
| Codebase | Keep the spine, revamp the surfaces | RLS, audit, Zod, `ReadResult`/`WriteResult`, the honest-state vocabulary and the test suite all survive. The principles that forbid a chatbot do not. |
| Scope | Chat + Agents + Memory, plus the ASI OS record | Today / Inbox / Projects / Activity stay and become the agent's working set. Research, Documents, Compare, Email are Phase G, gated on the core being good. |
| Mobile | Desktop-first, mobile pass later | Build at 1280px. Every layout decision must still be *reversible* into a small screen — see §7. |

---

## 1. What is actually built

Phase 0 complete, Phase 1 roughly two thirds. 146 source files, ~10,100 lines
across `app/`, `components/` and `lib/`. **132 RLS tests, 249 unit tests.**

**Surfaces that work with real data:** `/` (public product document),
`/early-access` (gated, metered public form), `/login`, `/auth/callback`,
`/today`, `/inbox`, `/projects`, `/projects/[id]`, `/activity`, `/settings`.

**The spine worth keeping, item by item:**

- **RLS is the boundary, and it is proven.** Five `public` tables, every one with
  `user_id uuid not null`, owner-scoped policies, `anon` holding no privilege on
  any of them. `tests/rls/` runs against real PostgreSQL with real policies and
  two real accounts. `scripts/guard-service-role.ts` fails the build if
  application code could reach the database as anything but the signed-in user.
- **A schema that cannot grow silently.** `tests/rls/isolation.test.ts`
  enumerates the schemas and tables and asserts the expected set. A new table
  without tests fails CI. **This is the single most valuable thing in the repo
  for the revamp**, because the revamp adds six tables.
- **Immutability by privilege, not by convention.** `inbox_items.content` carries
  no update privilege; `activity_events` has no update or delete policy at all.
  The pattern extends directly to chat messages — see §4.
- **Composite foreign keys that include the owner.** A capture cannot be linked
  to another account's project, and the failure is indistinguishable from
  referencing a project that does not exist. Every new relation copies this.
- **An atomic Postgres meter.** `0005_intake_meter_is_atomic.sql` implements a
  conditional upsert where the `WHERE` clause *is* the decision — no read-then-write
  race. This is exactly the mechanism the token budget needs. Reuse it, do not
  reinvent it.
- **Honest states as a closed vocabulary.** `components/os/states.tsx` — ready,
  calm, nothingYet, notConfigured, failed, loading — with deliberately no
  component for a placeholder. Model output gets two new members (§4.6).
- **Pure derivation with named evidence.** Everything `/today` asserts comes from
  `lib/derive/` and carries a row id. This becomes the *contract the model must
  also satisfy*.
- **Two design palettes with a meaning system.** Blue thinking, amber needs-you,
  sage confirmed, red failed, nothing decorative. Streaming, tool calls and
  approval states map onto this without inventing a colour.

**What does not exist:** no `app/api/`, no AI dependency, no streaming, no
external network call of any kind, no `conversations`, no memory, no multi-user
path that has ever been exercised.

---

## 2. What actively blocks the revamp

These are not features to add. They are things in the repository that will make
a coding agent argue with you, or that will break once a model writes to the
database. Phase A exists for them and nothing else should start first.

1. **The written principles forbid the product.** `AGENTS.md` says ASI OS "is not
   … a chatbot" and "do not implement a later phase unless asked".
   `docs/PRINCIPLES.md` §1 requires every surface to name a loop stage.
   `docs/IMPLEMENTATION_PLAN.md` §3 lists "no general-purpose chatbot as the
   primary surface", "no agent zoo", "no MCP" and "no mobile app" as explicit
   non-goals, and §4 says "No chat box until Phase 4." Cursor reads these files.
   Until they are rewritten, **every chat PR will be met with an agent explaining
   why it violates the rules** — correctly. Rewrite the documents before writing
   the code. This is Phase A task 1 and it is the highest-leverage hour in the
   whole plan.

2. **`updateSettings` reports success for a write that did nothing**, and
   `saveSettingsAction` writes an audit event on the strength of that answer
   (`AUDIT-2026-08-03.md` finding 1). Today that corrupts a settings history.
   After Phase D it corrupts *the record of what an agent was allowed to do*. Fix
   before any tool can write.

3. **A failed read is indistinguishable from an empty one** in `getSettings` and
   `getProfile` (finding 2). Same escalation: an agent that cannot read your
   projects must not be told you have none.

4. **There is no Content-Security-Policy.** The audit already recommended adding
   one "before there is model output to render." There is about to be model
   output to render, in Markdown, from a stream. This moves from *worth doing* to
   *required*, and it must land before Phase B ships.

5. **Single-owner is baked in.** `profiles.is_owner` with a unique index,
   `ASI_OWNER_EMAIL`, public signup disabled at the Supabase level. Friends can
   be created by hand in the Supabase dashboard — three accounts is thirty
   seconds of clicking — so **the invite flow is not on the critical path**. It
   is Phase F. Do not let it block Phase B.

6. **Cloud models plus other people equals a bill.** There is no rate limit, no
   token budget, no cost ceiling anywhere in the application. A friend leaving a
   tab open with a runaway agent loop is a real and boring way to lose money.
   Phase B ships the meter in the same milestone as the first token.

7. **The shell is a document shell, not a workspace shell.** `app/(os)/layout.tsx`
   is a 224px sidebar and a `max-w-5xl` prose column. A conversation list plus a
   thread plus an approval rail does not fit in it. Phase C rebuilds it.

---

## 3. Target architecture

Dependency direction is unchanged and non-negotiable:
`components/` → `app/` (pages, actions, route handlers) → `lib/` → Postgres.
The client never imports `lib/`.

```
app/
  (os)/
    layout.tsx                 # rebuilt: three-pane workspace shell
    chat/                      # NEW — the default surface
      page.tsx                 #   redirects to the most recent thread, or new
      [id]/page.tsx            #   one conversation
    today/ inbox/ projects/ activity/ settings/
    memory/                    # NEW — Phase E, not before
  api/                         # NEW — the first route handlers in the repo
    chat/route.ts              #   POST, streams. Delegates to lib/, holds no logic.
    chat/title/route.ts        #   one cheap structured call to name a thread
lib/
  ai/            # NEW
    providers.ts               # configured providers from env; fails closed
    models.ts                  # the closed model list + capabilities + cost
    facade.ts                  # streamConversation(), generateStructured()
    presets.ts                 # system prompts as data, scanned like lib/site/
    context.ts                 # bounded context assembly; returns a snapshot
    budget.ts                  # reserve / reconcile against the Postgres meter
  tools/         # NEW
    registry.ts                # name -> definition. The server's list, not the model's.
    read/                      # unrestricted: search and fetch the caller's own rows
    write/                     # approval-gated: everything that mutates
    execute.ts                 # runs a tool as the caller; writes invocation + audit
  memory/        # NEW — Phase E
    repository.ts lifecycle.ts retrieve.ts
  db/ derive/ schemas/ audit/ auth/ supabase/ format/    # unchanged, extended
components/
  os/            # extended: WorkspaceShell, Rail, ListPane
  chat/          # NEW — Thread, MessageList, Composer, StreamingMessage,
                 #       ToolCallCard, ApprovalBar, EvidenceList, ModelPicker
  memory/        # NEW — Phase E
```

### Stack additions, and only these

| Package | Why | Phase |
| --- | --- | --- |
| `ai` (AI SDK v6) | Provider independence, Zod-validated structured output, streaming, tool calling. Decided in `IMPLEMENTATION_PLAN.md` §17 Q1 and never recorded — record it as ADR 0011. | B |
| `@ai-sdk/anthropic`, `@ai-sdk/openai` | Two providers so the facade is proven swappable rather than assumed to be. | B |
| `@ai-sdk/react` | `useChat`. The only client-side AI dependency. | B |
| `react-markdown` + `remark-gfm` | Render model output. **Without `rehype-raw`. Ever.** | B |
| `shanki`/`shiki` or none | Code highlighting. Defer until a conversation actually contains code worth reading. | C |
| `cmdk` | ⌘K palette. Only if the hand-rolled one gets awkward. | C |

Nothing else. No vector database until keyword retrieval measurably fails (§6).
No queue, no worker, no realtime, no cron. Principle 10 survives the revamp
intact and is the reason this plan is achievable.

### Why route handlers, not Server Actions

Server Actions cannot stream a token at a time to a `useChat` hook. `app/api/chat/route.ts`
is the first `app/api/` in the repo. It resolves identity through
`lib/auth/session.ts` exactly like a page does — it is not a new trust boundary,
it is the same boundary in a different shape. It holds no business logic: it
authenticates, validates with Zod, calls `lib/ai/facade.ts`, and returns the
stream. Set `export const maxDuration = 300` (Vercel Pro) or `60` (Hobby).

---

## 4. The data model

Six new tables across four migrations. Every one: `user_id uuid not null
references auth.users(id) on delete cascade`, RLS enabled, owner-scoped policy,
`user_id` indexed, a unique constraint on `(id, user_id)` so children can carry
composite foreign keys, and RLS tests before it merges.

### 0006 — `conversations`, `messages`

```sql
-- conversations
id, user_id, title text,              -- null until the first exchange names it
model text not null,                  -- resolved model id at creation
preset text not null default 'default',
subject_type text, subject_id uuid,   -- optional: this thread is about a project
last_message_at timestamptz,
archived_at timestamptz,
created_at, updated_at

-- messages
id, user_id,
conversation_id uuid not null,
role text not null check (role in ('user','assistant')),
parts jsonb not null,                 -- AI SDK UIMessage parts, stored verbatim
model text, finish_reason text,
input_tokens int, output_tokens int,
created_at
-- foreign key (conversation_id, user_id) references conversations (id, user_id)
```

**`messages.parts` carries no UPDATE privilege.** A message, once sent, is what
was sent — the same reasoning that protects `inbox_items.content`, applied to the
one place where a rewritten history would be most useful and most dishonest.
Editing a message creates a new message and a branch; it never mutates the old
one. Store the AI SDK's `parts` array verbatim rather than flattening to text,
because tool calls, reasoning and results all live there and flattening loses the
audit.

### 0007 — `usage_counters` and the budget meter

Copy the mechanism from `0005_intake_meter_is_atomic.sql`: a conditional upsert
whose `WHERE` clause is the decision, so two concurrent requests cannot both pass
a limit that only one of them should.

```sql
usage_counters (user_id, scope, window_key) primary key
  -- scope in ('day','month'); window_key is 'YYYY-MM-DD' or 'YYYY-MM'
  requests int, input_tokens bigint, output_tokens bigint
```

Two phases, both required:

1. **Reserve**, before the provider call. Increments `requests` and a pessimistic
   token estimate. If the conditional upsert affects zero rows, the caller is over
   budget and the request never reaches the provider.
2. **Reconcile**, in `onFinish` *and* on abort *and* on error. Replaces the
   estimate with the actual usage. A stream the user cancels still costs money and
   must still be counted — this is the case people forget, and it is the case a
   bored friend will find in the first hour.

Limits live in `user_settings` (per-user, owner-editable) with a deployment
default in env. Settings shows the number and what is left, because a limit you
cannot see is a limit that feels like a bug.

### 0008 — `tool_invocations`

```sql
id, user_id, conversation_id, message_id,
tool_name text not null,              -- must exist in lib/tools/registry.ts
args jsonb not null,
status text not null check (status in
  ('pending_approval','approved','declined','executed','failed','reverted')),
requires_approval boolean not null,   -- copied from the registry, never the model
reversible boolean not null,
decided_at timestamptz, decline_reason text,
result jsonb, error text,
executed_at timestamptz, reverted_at timestamptz
```

### 0009 — `memory_items`, `memory_revisions` (Phase E)

As specified in `IMPLEMENTATION_PLAN.md` §7 and §10, unchanged. Three kinds
(profile, semantic, episodic), a status lifecycle, a source, a confidence of
`low|medium|high`, `superseded_by_id`, and an append-only revision trail.
Postgres full-text search with a `tsvector` generated column and a GIN index.
**pgvector is Later**, gated on a *measured* failure of keyword retrieval, and the
measurement must be written down before the extension is installed.

---

## 5. Agents: the part that makes this ASI OS and not a wrapper

Odysseus gives the model shell access. This deployment is a hosted app that three
people share, so it does the opposite: **the model gets a closed registry of
typed tools, and the server decides which of them need a human.**

### The registry

`lib/tools/registry.ts` maps a tool name to `{ inputSchema (Zod), requiresApproval,
reversible, execute, describe }`. A tool the model names that is not in the
registry cannot run — it is not "rejected by a check", it has no implementation to
reach. `requiresApproval` is read from the registry and copied onto the
`tool_invocations` row. **The model's opinion is never consulted.** This is
`PRINCIPLES.md` §5 preserved word for word through the revamp, which is the reason
that principle survives when the "not a chatbot" one does not.

**Read tools run without asking** — they only ever return rows the caller already
owns, through RLS, as the caller:
`search_projects`, `get_project`, `list_inbox`, `get_today`, `search_activity`,
`search_memory` (Phase E).

**Write tools stop and render an approval card** —
`capture_thought`, `create_project`, `set_next_action`, `set_project_status`
(with the required blocked reason), `archive_inbox_item`, `propose_memory`.

### The approval card is the recommendation card

`IMPLEMENTATION_PLAN.md` §11 designed a whole `recommendations` → `decisions` →
`actions` machinery. The revamp collapses it: **a proposed tool call *is* the
recommendation.** One table instead of four, the same four verbs, and the
approval lands where the user is already looking instead of on a separate
surface.

Every pending write renders: what it will do in one sentence, the exact typed
arguments, the rows it touched to decide, whether it can be undone, and four
verbs — **Approve**, **Modify** (edit the arguments, then approve), **Decline**
(reason required; this is the highest-value signal the system collects), **Why**
(the reasoning, collapsed by default — `PRINCIPLES.md` §9).

Execution writes the `tool_invocations` row *and* an `activity_events` row, so
Activity remains the one place where everything that ever happened is visible,
whether a human or a model did it. Reversible actions offer Undo for a real
window. Failures are first-class: `status='failed'` with the error surfaced in
both the thread and Activity. A tool that fails silently is a bug, not a degraded
result.

### Prompt injection, stated plainly

Tool *results* are data, never instruction. A project title someone typed, a
capture pasted from a website, and later any web page a research tool reads, are
all untrusted text arriving inside the model's context. The defence is not a
filter — it is that **the untrusted text has no privilege to escalate**: it
cannot add a tool to the registry, cannot flip `requiresApproval`, and cannot
reach a row RLS does not already permit. Write this down in the ADR, because it
is the reason the architecture is safe rather than a claim that it is.

---

## 6. Memory (Phase E)

Unchanged from `IMPLEMENTATION_PLAN.md` §10, which is good and should not be
redesigned. The one hard rule that makes the whole feature honest:

> **`suggested` memory is never injected into a prompt.** It is visible in the
> Memory surface and inert until confirmed.

Prove it with a test that fails if the retrieval query drops its status filter.
Every injected memory is recorded in the run's context snapshot, so a message can
show exactly which memories shaped it, collapsed by default. `times_used` and
`last_used_at` increment on use. Forget clears the content, sets `forgotten_at`,
and keeps the revision trail, so the *fact* of forgetting is auditable without the
content surviving.

---

## 7. The shell, and the mobile debt you are choosing to take on

Desktop-first was the call, so build at 1280px. The constraint that keeps it from
becoming expensive later:

> **Three panes, each of which is independently a full screen.**
> Rail (64px, icons + labels on hover) · List (280px, contextual) · Detail (fluid).

At desktop all three show. The mobile pass in Phase F then costs one layout file
and a router decision — rail becomes a bottom bar, list becomes a route of its
own, detail becomes the page — rather than a rewrite. **Never let a control exist
only in the gap between two panes,** and never put a primary action in a hover
state. Those two rules are the entire mobile insurance policy; everything else is
free to be desktop-shaped.

Streaming, tool calls and approvals map onto the existing colour meanings with no
new tokens: blue is the system thinking (the stream, the spinner), amber means
something needs you (a pending approval), sage means confirmed (an executed
tool), red means failed. `PRINCIPLES.md` §11 does more work after the revamp than
before it.

### Two new honest states

`components/os/states.tsx` gains exactly two members, and no more:

- **`Streaming`** — the model is producing. Distinct from `loading`, because the
  content is real and partial rather than absent.
- **`Unverified`** — the model asserted something whose evidence did not resolve
  to a row the caller owns. Shown instead of the claim, never alongside it. This
  is `PRINCIPLES.md` §2 acquiring the teeth it was always promised.

---

## 8. The roadmap

Each phase is shippable on its own. Sizes are rough agent-days for a competent
model working one task at a time with `npm run verify` green before each merge.

### Phase A — Make the repository willing (≈2 days)

Nothing here is a feature. Everything here is a thing that will otherwise cost
you ten times as much later.

| # | Task | Notes |
| --- | --- | --- |
| A1 | Rewrite `docs/PRINCIPLES.md`, `AGENTS.md`, and `IMPLEMENTATION_PLAN.md` §3/§4/§15–18 for the new direction | Keep §2 (never fabricate), §5 (human keeps control), §6 (memory visible), §7 (RLS is the boundary), §9 (progressive disclosure), §10 (structure earns its place), §11 (calm). Replace §1 and §4. Delete the "not a chatbot" and "no MCP/mobile" non-goals. |
| A2 | ADR 0011 — the AI SDK behind a facade | Answers `IMPLEMENTATION_PLAN.md` §17 Q1, finally. |
| A3 | ADR 0012 — chat is the front door, the record is the product | The reasoning in §0 above, as a decision. |
| A4 | ADR 0013 — the server registry decides approval, the model never does | Includes the prompt-injection argument from §5. |
| A5 | ADR 0014 — cloud models, one deployment key, per-user budget | Why not BYOK yet, why not local. |
| A6 | Fix audit findings 1 and 2 (`updateSettings`, `getSettings`, `getProfile`) | Audit M2/T2/T3. Blocking for Phase D. |
| A7 | `Field` wires `aria-describedby` / `aria-invalid` | Audit M3/T4. Do it now while there are seven callers, not twenty. |
| A8 | CI `permissions:` block, SHA-pinned actions | Audit T8. Three lines. |
| A9 | CSP, report-only | Audit T9. Report-only now, enforced in B6. |

**Done when:** `npm run verify` is green, no document in the repo argues against
the plan, and a fresh Cursor agent asked to "add a chat surface" does not object.

### Phase B — The AI spine and a real conversation (≈5 days)

| # | Task | Notes |
| --- | --- | --- |
| B1 | `lib/ai/` — providers, closed model list, facade, presets | Fails closed with a named missing variable, exactly like `lib/supabase/env.ts`. |
| B2 | Migration 0006 + RLS tests + `database.types.ts` | Composite FK, no UPDATE on `messages.parts`, schema enumeration test updated. |
| B3 | Migration 0007 + the budget meter + RLS tests | Reserve/reconcile. Copy 0005's conditional upsert. Include a concurrency test like `tests/rls/intake-concurrency.test.ts`. |
| B4 | `app/api/chat/route.ts` — auth, Zod, stream, persist in `onFinish` | Persist on abort and on error too. |
| B5 | `components/chat/` v1 — thread, composer, streaming message, Markdown | `react-markdown`, no `rehype-raw`, no `dangerouslySetInnerHTML`. |
| B6 | CSP enforced | Nonce for Next's bootstrap. Both public surfaces and every private one checked with the console open. |
| B7 | Budget surfaced in Settings + a real `notConfigured` state with no key | Wired or absent. |

**Done when:** you sign in, open `/chat`, have a streaming conversation that
survives a reload, and a second account provably cannot read your messages (RLS
test). A user at their limit is told so before the request leaves the server, and
a cancelled stream is still counted.

### Phase C — The workspace shell (≈4 days)

Three-pane shell; conversation list with rename, pin, archive; auto-titling via
one cheap structured call; model picker backed by the closed list; presets;
⌘K palette that navigates and captures; keyboard-first composer; the polish pass
that makes it read as a product rather than a demo.

**Done when:** you would rather open this than the ChatGPT app for something that
touches your own records.

### Phase D — Agents (≈5 days)

Tool registry; read tools; write tools; migration 0008 + RLS tests; the approval
card with four verbs; Undo; tool invocations in Activity; the fake-provider
contract tests from `IMPLEMENTATION_PLAN.md` §14 — a model output naming an
unregistered tool, one claiming `requiresApproval: false` on a mutating tool, and
one whose arguments reference another account's UUID must each be rejected safely
and visibly.

**Done when:** "read my inbox and start a project from the third one" runs end to
end: read tools execute silently, the write stops for approval, Approve executes
it, Activity records both, and Undo reverses it.

### Phase E — Memory (≈4 days)

Migration 0009; the Memory surface with three tabs; Confirm / Correct / Forget
with visible revision history; keyword retrieval into `lib/ai/context.ts`;
"memories used" collapsed on each assistant message.

**Done when:** suggested memory provably never enters a prompt, and forgotten
memory provably never returns — both as tests, not as claims.

### Phase F — Friends, and then phones (≈4 days)

Invite flow end to end (audit M6); first-minute onboarding (M7); export and
delete (M8 — non-negotiable before a second person's data is in there); then the
mobile pass: bottom rail, list-as-route, PWA manifest, installability, thumb-reach
audit of the composer and the approval card.

**Done when:** a friend gets an email, sets a password, lands somewhere useful,
uses it from a phone on the train, and can export or delete everything they own.

### Phase G — Odysseus parity, chosen deliberately (unscheduled)

In the order I would build them, with the reason each is *not* earlier:

1. **Deep Research** — highest wow-per-line in the whole list and the best thing
   to show a friend. Not earlier because it needs the tool registry (D) to be real
   and because web content is the first genuinely untrusted input in the system.
2. **Documents** — a writing surface with AI edits. Not earlier because it
   overlaps Projects and Inbox and needs the memory layer to be worth using.
3. **Compare** — cheap once the provider facade exists. Mostly a curiosity when
   you are paying per token rather than running local weights.
4. **MCP** — per-user MCP servers on serverless is a real infrastructure project.
   Revisit when a specific server is wanted, not before.
5. **Image generation, Email, Calendar** — each is a new provider, a new privacy
   surface, and a new failure mode. None of them makes the core better.

**Never, on this deployment:** shell/code execution (Odysseus can afford it
because it runs on your own machine; a hosted app three people share cannot),
local model serving, and the Cookbook — there is no GPU here to recommend a model
for.

---

## 9. Risks, honestly

| Risk | Mitigation |
| --- | --- |
| Cost runs away | Phase B ships the meter with the first token, not after. Reserve before the call, reconcile on finish, abort and error. |
| Model output XSS | CSP enforced in B6, Markdown without raw HTML, no `dangerouslySetInnerHTML` on model output anywhere. |
| Prompt injection via tool results | The registry is the privilege boundary; untrusted text cannot add a tool, flip an approval flag, or reach a row RLS forbids. |
| Serverless streaming timeouts | `maxDuration`; persist partial output on abort so a timeout loses a stream, not a conversation. |
| The revamp erodes what made this good | The rules that survive are listed in A1 by number. If a PR breaks one of them, it is wrong even if it works — same as before. |
| Scope creep toward all eight Odysseus surfaces | Phase G exists to hold them, and every entry there names why it is not earlier. |

---

## 10. Open decisions

Answer these before the phase that needs them; do not let them block earlier work.

1. **Default model.** Recommend Claude Sonnet as the workhorse with Opus
   available per-conversation. Needed by B1.
2. **One deployment key, or bring-your-own?** Recommend one key plus per-user
   budgets for three friends, with BYOK deferred until someone asks. Needed by
   B1; decided in ADR 0015.
3. **Does the model see Today, or ask for it?** Recommend: ask for it, via the
   `get_today` read tool. Injecting the whole record into every system prompt is
   how context budgets die. Needed by D.
4. **Conversation retention.** Recommend: never auto-delete, archive only,
   because the record is the product. Needed by F (export).
5. **Does chat replace Today as the landing route?** Recommend: yes after Phase
   C, no before it. Needed by C.
</content>
