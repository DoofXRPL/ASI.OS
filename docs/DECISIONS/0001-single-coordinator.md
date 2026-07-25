# 0001 — One Coordinator, not a crew

- **Status:** Accepted
- **Date:** 2026-07-25
- **Applies from:** Phase 2 (no agent code exists in Phase 0)

## Context

The predecessor project this one learned from ran a multi-agent crew for every
request: an orchestrator drafted a plan, three specialists ran in sequence over a
shared memory log, then the orchestrator synthesised an answer. Five model calls
per message.

Reading that code closely showed two things:

1. The orchestrator's "plan" never routed anything. The specialist list came from
   configuration, so the plan phase produced text that was displayed and then
   ignored. It was trace theatre.
2. Specialists ran sequentially even where they were independent, so the design
   paid latency for coordination it did not perform.

That project's own product review listed "plan-driven routing" and "tiered models"
as its highest-priority fixes — an admission that the roster arrived before the
need for one.

## Decision

ASI OS starts with **one** agent: the ASI Coordinator.

Its output is a **Zod-validated structured contract** — summary, evidence,
assumptions, confidence, consequence of inaction, proposed actions, whether
approval is required, and candidate memories.

A specialist is added only when it has a **distinct tool boundary** — a capability
the Coordinator genuinely cannot hold, such as web access. "It would be tidier to
separate concerns" is not sufficient reason; separate prompts are not separate
agents.

A Memory Curator specialist is explicitly rejected: curation is a deterministic
job, not a reasoning problem.

## Consequences

- One model call for a recommendation instead of five. Lower latency, lower cost,
  and a far shorter list of places a failure can hide.
- The output contract, not the agent count, becomes the thing that makes the
  system trustworthy. `approval_required` from the model is advisory only; a
  server-side action registry decides what needs a human.
- Naming a "crew" in the interface is not possible, which removes the temptation to
  present activity as progress.
- If genuine parallel specialisation is needed later, the contract already
  describes a unit of work that can be produced by more than one producer, so this
  is not a one-way door.
