# 0010 — The meter counts atomically, and counts networks

- **Status:** Accepted
- **Date:** 2026-07-30
- **Amends:** [0009](0009-the-front-door-is-gated-and-metered.md) §2 and §3

## Context

ADR 0009 put a meter on the front door: one row per call in
`access.intake_attempts`, a `select count(*)` over a window, and a refusal once
the count reached the threshold in `access.intake_limits`. The key gate it
installed alongside is correct and unchanged. The meter enforced nothing.

Everything below was measured against PostgreSQL 16.14 with the migrations
applied, and against a production build of the application talking to it. None of
it was inferred from reading the code.

### The count was read and then acted on

`select count(*)` followed by `insert`, with no lock, at the READ COMMITTED
isolation every PostgREST call runs at. Concurrent transactions cannot see each
other's uncommitted rows, so they all read the same number and all decide they
are under the limit:

| calls, in parallel | `per_client_max` | rows written |
| --- | --- | --- |
| 12 | 5 | 11 |
| 40 | 5 | 33 |
| 100 | 3 | 41 |
| 60 distinct callers | `global_max` 10 | 33 |

The same calls made one at a time stop at exactly the limit. That is why 125
passing RLS tests said nothing about it: every one of them submitted on a single
connection inside a transaction that was rolled back, which is the one
arrangement in which a check-then-act meter looks perfect.

### Refusals counted towards the window that refused them

A refused call inserted a `throttled` row, and the deployment-wide count included
every row in the window whatever its outcome. So traffic that was being refused
kept the ceiling met. Measured with the window compressed to a minute and the
ceiling to ten, one address knocking twelve times a minute held the count at
twelve to fourteen for two and a half full windows, and every first-time visitor
who arrived during it was refused. The control — the same attacker at six knocks a
minute, below `global_max / global_window` — drained normally and every visitor was
accepted, which is what shows the lockout was caused by the refusals rather than
by load.

At the shipped defaults the sustaining rate is 200 rows an hour, or one request
every eighteen seconds. The edge token bucket permits one every six.

### Counting got more expensive the more there was to count

The deployment-wide `count(*)` had no bound but the window. Measured with the
table vacuumed at each step, so the variable is live rows and not bloat:

| rows in the window | median call |
| --- | --- |
| 1,000 | 0.82 ms |
| 10,000 | 1.48 ms |
| 100,000 | 6.48 ms |
| 1,000,000 | 78.97 ms |

Aging the same million rows just outside the window, leaving the table exactly as
large, returned the call to 0.96 ms. So the cost was the rows being counted and
nothing else — not table size, not the prune, which was 0.09 ms. Forcing the count
onto `intake_attempts_created_idx` made it slower, not faster (73 ms against 69
ms): an index-only scan of a million entries is still a scan of a million entries.
An index is not a fix for this and adding one would have looked like one.

### One caller had as many budgets as they had addresses

`hashClientId` hashed the exact address. An IPv6 /64 is the smallest block a site
is ever assigned — RFC 4291 fixes the interface identifier at 64 bits — so every
one of its addresses is the same subscriber, and each got its own budget. Through
the built application, 60 submissions rotating inside one /64 were all accepted
against a limit of 5, and 200 rows — the entire deployment-wide ceiling — went in
from one machine in 2.7 seconds, after which an unrelated visitor was refused.

## Decision

### 1. The increment is the decision

`access.intake_counters` holds one row per bucket per fixed window, and the
threshold is the condition of the statement that raises it:

```sql
insert into access.intake_counters as c (bucket, window_start, admitted)
values (v_client, v_window, 1)
on conflict (bucket, window_start) do update
  set admitted = c.admitted + 1
  where c.admitted < v_limits.per_client_max
returning c.admitted
```

`ON CONFLICT DO UPDATE` locks the conflicting row, so concurrent callers queue on
it and are handed distinct successive numbers. Nothing is read and then acted on.
A call that returns no row was refused *without having incremented anything*,
which is what makes the ceiling drain again.

Re-measured, every scenario in the first table above now writes exactly the limit,
and forty refused knocks leave the ceiling's own count where they found it.

### 2. Not an advisory lock

`pg_advisory_xact_lock` was the obvious alternative and was measured rather than
assumed. It is correct — 40 parallel calls, exactly 5 admitted — and it is worse:

| mechanism | 40 parallel, one caller | 30 parallel against a global ceiling |
| --- | --- | --- |
| as shipped | 33 admitted (wrong) | — |
| advisory lock | 5 admitted, 42.5 ms | 834 ms |
| counter row | 5 admitted, 16.7 ms | 13.5 ms |

The global figure is the one that decides it. A deployment-wide ceiling needs one
lock shared by every caller, so it serialises the whole endpoint behind a count
that is itself O(rows) — the queue is self-inflicted and grows with the flood. The
counter is 62 times faster there, and fixes the cost and the lockout as well as
the race, where the lock fixes only the race.

### 3. Counters, not one row per call

`access.intake_attempts` is dropped. It was what made counting unbounded, and a
count of `admitted` and `refused` per bucket per window is a better answer to "was
there a flood last night" than a `count(*)` over whatever had not yet been pruned.
Cost is now flat: 1.33 ms per call with a thousand buckets in the window and 1.82
ms with a million.

Refusals are still recorded, in `refused`, and read by nothing.

### 4. Fixed windows, and what that costs

A window is now a row, so windows tumble rather than slide. The price is that a
caller who times a boundary can send their budget twice in quick succession. That
is a bound rather than a hole, the edge token bucket caps the rate at which it can
be reached, and this design had already accepted an equivalent reset: `bucket`
includes the UTC date, so every caller's budget already restarted at midnight.

The alternative — an exact sliding window — requires counting rows under a lock,
which is both mechanisms above at once and reintroduces the cost that grows with
the attack.

### 5. The bucket is a network for IPv6 and an address for IPv4

`clientBucket` normalises an IPv6 address to its /64 and leaves IPv4 alone. Both
halves are deliberate.

A /64 is one subscriber, so grouping it refuses nobody who was not already
sharing, and it closes a bypass that costs an attacker nothing. An IPv4 /24 is up
to 256 unrelated subscribers of a carrier or a host, so grouping one would refuse
strangers for each other's traffic; and an IPv4 address is already shared by
everyone behind a NAT, which makes it no coarser than an IPv6 /64 to begin with.
Rotating IPv4 requires addresses an attacker must actually acquire, which is a
different and far higher cost than binding another address in a block they already
hold. A genuinely distributed IPv4 flood is what the deployment-wide ceiling and
the platform firewall are for.

`clientBucket` also returns nothing for a value that is not an address, so a
forwarded header carrying an arbitrary token shares the unattributed bucket
instead of becoming an identity of its own. That matters wherever nothing in front
of the application overwrites the header; on Vercel the platform sets all three.

The edge token bucket keys on the same function, because a caller the database
counts as one and the edge counts as eighteen quintillion is not one limit
described twice.

### 6. A submission the queue refuses still costs the caller their count

The count is now made before the insert, and the insert is wrapped in an exception
block for the two classes a submission can cause — malformed data, and a violated
constraint. Before this, a constraint violation rolled the count back with it, so
25 malformed calls consumed no budget at all and left nothing in the meter.

This is not reachable through the form: the Zod schema is at least as strict as
every CHECK constraint, and the one input it accepted that PostgreSQL cannot store
— a NUL byte — is rejected during parameter binding, before the function body is
entered, so no handler inside it could have caught it. It is now refused at the
boundary as well, in `lib/schemas/early-access.ts`.

It is reachable by a caller holding the intake key, which is exactly the case the
meter exists for. The key is a shared secret in an environment variable and is
explicitly not privileged; if it leaks, the meter is the only limit left, and a
limit with a free path through it is not one.

The function returns `failed` rather than raising, so the count survives. The
SQLSTATE is raised as a warning to the PostgreSQL log — never `SQLERRM`, which is
entitled to quote the row that failed, and that row is somebody's answers.

## Consequences

- The two thresholds are exact under concurrency. `npm run test:rls` includes
  `tests/rls/intake-concurrency.test.ts`, which submits from up to a hundred real
  connections and fails against the previous meter by 25, 6 and 43 rows.
- The deployment-wide ceiling can no longer be held shut by traffic it is
  refusing. Under the attack that previously locked out every first-time visitor,
  all of them are now accepted.
- The meter's cost no longer grows with the flood it absorbs, so the public form
  can no longer degrade the connection pool the private product shares.
- An actor with one IPv6 allocation has one budget instead of one per address.
- A caller can exceed their budget by up to a factor of two across a window
  boundary. Accepted, and stated in `docs/SECURITY.md` §8.
- Preview and production deployments pointed at one Supabase project still share
  the deployment-wide counter, as they shared the previous window. Stated in
  `docs/SECURITY.md` §8.
- Volumetric denial of service is still not answered in the database, and cannot
  be. `docs/SECURITY.md` §5 is the answer, and it is a launch step rather than a
  code change.
