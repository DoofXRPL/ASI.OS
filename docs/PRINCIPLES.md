# ASI OS — Principles

These are review criteria, not aspirations. A change that violates one of them is
wrong even if it works.

## 1. The loop is the product

ASI OS exists to run one loop:

**Observe → Understand → Recommend → Approve → Act → Remember**

Every surface must be able to name which stage it serves. `components/os/nav.ts`
records that stage per route and `PageHeader` displays it. A surface that cannot
name its stage is decoration and does not ship.

## 2. Never fabricate

No placeholder numbers. No sample data presented as real. No metric that is not
read from a record.

Every surface renders exactly one of the states in `components/os/states.tsx`:

- `ready` — real data from a real record
- `CalmState` — nothing needs you, stated with confidence
- `NothingYet` — never used, with one concrete first step
- `NotConfigured` — a prerequisite is missing, named precisely
- `Failed` — what broke, what it means, what to do
- `Skeleton` — a shape, never a zero or a dash

There is deliberately no component for a placeholder value or a "coming soon"
panel. If a surface cannot be one of the above, it is not ready.

Once the reasoning layer exists, this principle acquires teeth: every piece of
evidence in a recommendation must resolve to a row the user owns, checked
server-side, or the recommendation is not shown.

## 3. Wired or absent

A control that looks real but changes nothing is a trust bug. It is worse than a
missing feature, because it teaches the reader that the interface lies.

So: a preference exists in `lib/schemas/settings.ts` only if something reads it,
and a control appears in Settings only if it is connected to a real record.

## 4. Navigation earns its place

A surface enters the navigation in the phase that makes it functional, never
earlier. Empty shells badged "soon" are the most expensive kind of dishonesty in a
product about trust. See `docs/DECISIONS/0002-navigation-earns-its-place.md`.

Deferred surfaces return a real 404, which is true: they do not exist yet.

## 5. The human keeps control of consequential actions

Nothing consequential happens without approval, and the **server** decides what
is consequential. When the reasoning layer arrives, the model's own
`approval_required` flag will be advisory only: an action registry on the server
determines what needs a human, so a model can never talk its way past a gate.

## 6. Memory is visible, sourced, editable and forgettable

Memory that the user cannot see, correct, or delete collapses the entire premise.
Every durable memory will carry a source, a status, a confidence and a correction
history, and nothing merely *suggested* will ever influence a recommendation.

## 7. Isolation is enforced by the database

Row Level Security is the only isolation boundary. Application filters are defence
in depth, never the mechanism.

The application holds no privileged database credential. There is no code path
that can read another account's records — not a bug to be avoided, but a
capability that does not exist. `npm run guard:service-role` enforces this, and
`tests/rls/` proves it against a real database with two real accounts.

## 8. Explain, and say what happens if you do nothing

Every recommendation must say why it matters, what evidence it rests on, how
confident it is, and what happens if it is ignored. Silence is never consent.

## 9. Progressive disclosure

A one-line answer by default; the reasoning on request. Never open with a full
trace.

## 10. Build structure only when real use earns it

No vector database, queue, worker, realtime layer, or cron until something
measurably needs one. Each addition must name the problem it solves and the
evidence that the problem exists.

## 11. Calm by default

Colour is rationed and carries meaning: blue is the system thinking, amber means
something needs you, sage means confirmed or healthy, red means failed. Nothing is
coloured for decoration, so when colour appears it can be trusted.

"Nothing needs you" is a designed state, not a blank one.
