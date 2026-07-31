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
applied to two databases built from the files — one stopping at 0004, one with
0005 — and against production builds of the application talking to each. None of
it was inferred from reading the code.

### The count was read and then acted on

`select count(*)` followed by `insert`, with no lock, at the READ COMMITTED
isolation every PostgREST call runs at. Concurrent transactions cannot see each
other's uncommitted rows, so they all read the same number and all decide they
are under the limit. Five runs of each scenario, since a race does not produce one
number:

| calls, in parallel | limit | rows written, 0004 | rows written, 0005 |
| --- | --- | --- | --- |
| 40, one caller | `per_client_max` 5 | 11–39 (22, 24, 11, 39, 38) | 5 every run |
| 100, one caller | `per_client_max` 3 | 6–78 (13, 6, 33, 56, 78) | 3 every run |
| 60 distinct callers | `global_max` 10 | 48–59 (48, 59, 58, 57, 54) | 10 every run |

The same calls made one at a time stop at exactly the limit. That is why the 132
passing tests covering this path said nothing about it: every one that reached the
database submitted on a single connection inside a transaction that was rolled
back, which is the one arrangement in which a check-then-act meter looks perfect.

### Refusals counted towards the window that refused them

A refused call inserted a `throttled` row, and the deployment-wide count included
every row in the window whatever its outcome. So traffic that was being refused
kept the ceiling met.

Directly: with the ceiling set to three and then filled, forty refused knocks left
the number the next decision reads at **43** under 0004 and at **3** under 0005.

End to end, with the ceiling at five a minute and a knocker deliberately *under*
it at three calls a minute — a rate the ceiling could absorb with two to spare — a
first-time visitor arriving in the following window was answered `throttled` under
0004 and `accepted` under 0005. Staying under the ceiling is what separates this
from ordinary saturation: an actor who fills a shared ceiling legitimately is the
shared fate `docs/SECURITY.md` §8.3 accepts, whereas an actor whose *refusals* pay
for themselves shuts the door for free.

At the shipped defaults the sustaining rate was 200 rows an hour, or one request
every eighteen seconds. The edge token bucket permits one every six.

There was a cheaper route to the same place, which no report named. A caller over
their *own* limit still spent the deployment's budget, because the refusal it
earned was a row and the deployment count included every row. With `per_client_max`
2 and the ceiling 50, twenty calls from one caller consumed **20** of the 50 under
0004 and **2** under 0005. At the shipped defaults that is one address filling a
ceiling of 200 with calls that could never have been admitted — a couple of minutes
of work at the rate the edge bucket allows, and no need to sustain anything
afterwards.

The fix is the same one: only an admitted call increments `admitted`, and the
caller's own limit is checked first, so a caller who is over it returns before the
deployment's counter is touched at all.

### Counting got more expensive the more there was to count

The deployment-wide `count(*)` had no bound but the window. Median of 25 calls at
each step, with the table vacuumed and analysed each time so the variable is live
rows and not bloat:

| rows in the window | median call, 0004 | median call, 0005 |
| --- | --- | --- |
| 1,000 | 0.59 ms | 0.77 ms |
| 10,000 | 1.34 ms | 0.92 ms |
| 100,000 | 5.60 ms | 0.85 ms |
| 1,000,000 | 47.33 ms | 0.99 ms |

Aging the same million rows just outside the window, leaving the table exactly as
large, returns the call to under a millisecond. So the cost was the rows being
counted and nothing else — not table size, and not the prune. `explain (analyze,
buffers)` on the statement the function issues confirms it: a parallel sequential
scan aggregating 333,333 rows in each of three workers, 87 ms of execution time,
13,593 buffers touched. Two of those workers are per form submission, so a flood
also competes for the parallel worker pool.

An index is not a fix and adding one would have looked like one: forcing the count
onto `intake_attempts_created_idx` made it slower, because an index-only scan of a
million entries is still a scan of a million entries. What removes the cost is not
counting rows at all.

The measurement is easy to get wrong, and was, twice. A version of this table read
2.29 ms at a million rows because a previous scenario had left `global_window` at
one minute, so the count was over a minute's rows rather than the window's; and the
same probe at four million rows failed outright with `could not resize shared
memory segment` because the container's `/dev/shm` was 64 MB, which is the parallel
plan running out of room rather than anything about the meter. Both were artefacts
of the harness. The table above is from a harness that restates every threshold on
every call.

### One caller had as many budgets as they had addresses

`hashClientId` hashed the exact address. An IPv6 /64 is the smallest block a site
is ever assigned — RFC 4291 fixes the interface identifier at 64 bits — so every
one of its addresses is the same subscriber, and each got its own budget. Through
the built application, submitting the form as a browser without JavaScript does:

| rotating inside one /64 | 0004 + exact-address digest | 0005 + `clientBucket` |
| --- | --- | --- |
| 60 submissions, limit 5 | 60 accepted | 5 accepted, 5 throttled, 50 refused at the edge |
| 260 submissions, shipped defaults | 200 rows — the whole ceiling — in 2.5 s | 5 rows |
| an unrelated visitor, immediately after | `throttled` | `accepted` |

The edge token bucket did not help before, because it keyed on the exact address
too: rotating refilled it as reliably as it emptied the meter in PostgreSQL. It is
the 50 refusals in the top right cell, and they are there because both layers now
ask the same function what counts as one caller.

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

Re-measured, every scenario in the first table above now writes exactly the limit
on every run, and forty refused knocks leave the ceiling's own count where they
found it.

### 2. Not an advisory lock

`pg_advisory_xact_lock` was the obvious alternative and was measured rather than
assumed, as a third meter over 0004's table, driven by the same probe. It is
correct, and it is slower, and the gap widens exactly where it matters:

| 30 parallel callers | rows of history | advisory lock | counter row |
| --- | --- | --- | --- |
| one caller, `per_client_max` 5 | 0 | 5 admitted, 51 ms | 5 admitted, 13 ms |
| one caller, `per_client_max` 5 | 300,000 | 5 admitted, 166 ms | 5 admitted, 15 ms |
| 30 callers, `global_max` 10 | 0 | 10 admitted, 259 ms | 10 admitted, 13 ms |
| 30 callers, `global_max` 10 | 300,000 | 662 ms | 10 admitted, 19 ms |

The global rows decide it. A deployment-wide ceiling needs one lock shared by every
caller, so it serialises the whole endpoint behind a count that is itself O(rows):
the queue is self-inflicted and grows with the flood. Twenty times slower with an
empty table, thirty-five times with a modest amount of history.

The lock also fixes only the race. It leaves the cost and the lockout, because both
come from *what* is counted rather than from the absence of a lock. The counter
fixes all three and is less code, which is the whole of the argument.

(The last row admits nothing at all under the lock because 300,000 seeded rows are
themselves in its window and over the ceiling of ten — which is the O(rows)
problem restated, not a separate defect.)

### 3. Counters, not one row per call

`access.intake_attempts` is dropped. It was what made counting unbounded, and a
count of `admitted` and `refused` per bucket per window is a better answer to "was
there a flood last night" than a `count(*)` over whatever had not yet been pruned.
Cost is flat, as the third column of the scaling table shows: every read is a
primary-key lookup, so a million buckets in the window cost what a thousand do.

Refusals are still recorded, in `refused`, and read by nothing.

Pruning had to change with it. 0004 deleted every expired row on every call, which
is free until there are many, at which point concurrent callers all attempt the
same large delete and queue on each other's row locks. Sixty callers pruning at
once, against a backlog of expired windows:

| backlog | unbounded delete | bounded to 200 with `skip locked` |
| --- | --- | --- |
| 1,000 | 23 ms | 33 ms |
| 100,000 | 255 ms | 68 ms |
| 1,000,000 | 2,288 ms | 78 ms |

The bound costs a little when there is nothing to bound, and two orders of
magnitude less when there is. It keeps up because a call creates at most two rows
and removes up to two hundred: a thousand expired rows drain in five calls.

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
constraint. Before this, a constraint violation rolled the count back with it: six
refused submissions from one caller against a budget of five left the meter reading
**0** under 0004 and **6** under 0005.

A NUL byte was how a stranger reached that path. Through the built application it
passed the Zod schema, and the page answered "could not be recorded" while the
meter recorded nothing at all — an unlimited number of free calls, each one a full
round trip to PostgreSQL. It is now refused at the boundary, in
`lib/schemas/early-access.ts`, where the page names the field instead.

The exception block matters anyway, for the case the boundary cannot cover: a caller
holding the intake key and calling the function directly. That is exactly the case
the meter exists for — the key is a shared secret in an environment variable and
explicitly not privileged — and a limit with a free path through it is not one.

The function returns `failed` rather than raising, so the count survives. The
SQLSTATE is raised as a warning to the PostgreSQL log — never `SQLERRM`, which is
entitled to quote the row that failed, and that row is somebody's answers.

## Consequences

- The two thresholds are exact under concurrency. `npm run test:rls` includes
  `tests/rls/intake-concurrency.test.ts`, which submits from up to a hundred real
  connections rather than one, and asserts the exact limit; the first table above
  is what the same calls do without 0005.
- The deployment-wide ceiling can no longer be held shut by traffic it is
  refusing. Under the attack that previously locked out a first-time visitor, that
  visitor is now accepted.
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
