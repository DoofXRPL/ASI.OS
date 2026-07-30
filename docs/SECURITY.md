# Security — the anonymous intake path

ASI OS has exactly one write an unauthenticated stranger can perform: the
early-access form at `/early-access`. Everything else requires a session and is
answered by Row Level Security, which is covered by
[Principle 7](PRINCIPLES.md#7-isolation-is-enforced-by-the-database) and proved by
`tests/rls/`.

This document is about the one exception. It records what is protecting it, what
is not, and what to reach for if that changes.

Decisions: [ADR 0008](DECISIONS/0008-the-front-door-is-its-own-schema.md) built
the queue; [ADR 0009](DECISIONS/0009-the-front-door-is-gated-and-metered.md)
locked and metered it;
[ADR 0010](DECISIONS/0010-the-meter-counts-atomically.md) made the meter hold
under concurrency, which the first one did not.

## 1. What the path is

```
visitor
  │  POST /early-access
  ▼
proxy.ts ──────────────── content-length over 64 KB → 413
  │                       token bucket empty        → 429 + Retry-After
  ▼
Server Action ─────────── honeypot filled  → answered as a success, recorded
  │                       schema failed    → field errors, no database call
  ▼
lib/db/early-access.ts ── no intake key or no Supabase → "not being recorded"
  │  supabase.rpc(..., p_key, p_client)
  ▼
public.request_early_access()  SECURITY DEFINER, search_path pinned
  │  unrecognised key             → refused
  │  unmeterable caller           → refused
  │  over the per-caller window   → throttled
  │  over the deployment ceiling  → throttled
  ▼
access.early_access_requests   (no API role holds any privilege on it)
```

Four layers, in ascending order of how much they can be trusted. The first two run
in code an attacker can choose not to execute. The last one runs for every caller,
including the one holding nothing but the publishable key.

## 2. Threat model

The publishable key is public — that is what it is for — so the starting
assumption is that the attacker has it, knows the project URL, and can call
PostgREST directly. Row Level Security is what makes that safe for every other
table; the intake function is the only object `anon` may execute.

| # | Threat | What answers it | Residual risk |
| --- | --- | --- | --- |
| 1 | Direct calls to the RPC, bypassing every application check | `p_key` must match a digest in `access.intake_keys` | The key leaking. It is server-only, absent from client bundles, and confined to one module by `npm run guard:service-role` |
| 2 | Mass submission through the form | Per-caller window and deployment ceiling in `access.intake_limits`, enforced by the statement in `public.request_early_access()` that counts the call, so concurrent callers queue on one row rather than each reading the same number | A caller who times a window boundary sends `per_client_max` twice across it; the ceiling is a bound, not a hole |
| 2a | One machine rotating addresses to get a budget per address | The counted identity is a *network*: an IPv6 address is bucketed to its /64 before hashing, so the 18 quintillion addresses one subscriber can bind share one budget | IPv4 is not truncated on purpose (§8.7). Rotating IPv4 needs addresses genuinely acquired, and the deployment ceiling answers that |
| 3 | Burst flooding of the Server Action | Token bucket in `proxy.ts`, then the database's own count | The bucket is per instance. Deliberate: it is the cheap layer, not the load-bearing one |
| 4 | Oversized or malformed bodies | `content-length` check in the proxy, `bodySizeLimit` of 64 KB, Zod at the boundary, CHECK constraints in the table | None material. A body that lies about its length is refused by the body limit rather than the header check |
| 5 | Naive bots submitting every input they find | Honeypot field, answered as a success so the bot learns nothing | A bot that renders the page and respects `aria-hidden` gets past it and meets the rate limits instead |
| 6 | Using the form to test whether an address is registered | The function returns `accepted` for a duplicate exactly as for a new row; `on conflict do nothing` | None. The queue cannot be read, counted, or probed through any exposed object |
| 7 | Reading or tampering with the queue | Schema not exposed to PostgREST; no privilege for `anon` or `authenticated`; RLS on with no policies | None known. Enumerated in `tests/rls/early-access.test.ts` |
| 8 | Raising the limits or registering a key from outside | `access.intake_keys` and `access.intake_limits` are as unreachable as the queue | None known |
| 9 | Correlating submissions to people from the counters | `access.intake_counters.bucket` is an HMAC of the caller's network and the UTC date, and the column's constraint accepts nothing else | Someone holding both the intake key and the database could test a guessed network against a same-day row |
| 10 | Volumetric denial of service | Not answered in application code | Real, and out of scope here. See §5 |
| 11 | Cross-site request forgery | Next.js verifies `Origin` against `Host` for every Server Action | None material. Do not add `allowedOrigins` without a specific reason |
| 12 | Exposing personal data through logs | The log record is a closed shape with no field for a name, address, email or message | A database error message could quote the failing row, so only the error *code* is logged |

Explicitly out of scope: the authenticated product surfaces (Row Level Security,
tested separately), account takeover (Supabase Auth), and anything about an AI
layer that does not exist.

## 3. Configuring the door

Two halves, neither of which works alone:

```bash
npm run intake:key -- --label "vercel-production"
```

It prints the environment variable and the SQL statement, and connects to
nothing — applying a statement to a live project is a decision to make
deliberately. Set `ASI_INTAKE_KEY` in the deployment, run the `insert` against the
project it belongs to, and the door opens.

Until both halves are in place the form says requests are not being recorded. That
is accurate, not a bug: an unrecognised caller is refused by the database.

**Rotating** is a deploy, not an outage, because several unretired keys may exist
at once:

```sql
-- 1. register the new digest, 2. ship the new ASI_INTAKE_KEY, then:
update access.intake_keys set retired_at = now() where label = 'the-old-one';
```

**Retuning** the limits needs no deployment at all:

```sql
update access.intake_limits
   set per_client_max = 3,
       per_client_window = interval '1 hour';
```

Defaults: five per caller per fifteen minutes, two hundred across the deployment
per hour, counters remembered for twenty-four hours. Every column is bounded, so
the door cannot be configured shut or configured away.

Both windows are fixed rather than sliding: `access.intake_window()` floors the
current instant to a multiple of the window, and that instant is part of the
counter's primary key. Lowering a limit therefore applies to the next increment,
not retroactively — a bucket already above a newly lowered `per_client_max` stops
admitting immediately, because the limit is the increment's own condition.

## 4. Bot mitigation: why there is no CAPTCHA

All four options were considered. None is being added, and the reasoning should be
read before adding one.

| Option | What it costs | Verdict |
| --- | --- | --- |
| **Cloudflare Turnstile** | A third-party script on a page that loads none; a form that stops working with JavaScript disabled unless the check is advisory, in which case it is decorative; a dependency and two more secrets | **The first thing to reach for if the layers here prove insufficient**, on the strength of no behavioural tracking and an accessible non-interactive mode |
| **hCaptcha** | The same costs, plus an interactive challenge in more cases | Second choice. Better privacy posture than reCAPTCHA, worse completion than Turnstile |
| **reCAPTCHA Enterprise** | The same costs, plus sending every visitor's behaviour to an advertising company and a per-assessment bill | **Rejected.** A product whose argument is that your records are yours cannot open with a tracker |
| **Invisible signals** (dwell time, a signed render token, honeypots) | Almost nothing; the honeypot is already there | **Partly adopted.** The honeypot is in place. A signed render token was considered and rejected: it expires, and an expired token means telling somebody who filled in a long form to fill it in again |

The case for waiting is that a CAPTCHA answers "is this a human", while the
problem here is "how many rows can one actor create". The key gate and the meter
answer the second question directly, cannot be solved by a solver service, and add
no dependency, no script, and no accessibility regression.

The trigger for revisiting is evidence, not suspicion: rows in the queue that are
obviously machine-generated, or a sustained `throttled` rate in the logs, meaning
something is trying hard enough to be worth another layer.

## 5. WAF strategy

The proxy and the database limit how many rows an actor can create. Neither
reduces the number of requests that reach the deployment, and no amount of
application code can — by the time it runs, the request has been paid for.
Absorbing that is what a firewall in front is for, and this is where managed rules
beat anything written here.

Recommended on Vercel Firewall, roughly in the order worth adding them:

1. **A rate-limit rule on `POST /early-access`** — around 20 requests per minute
   per IP, `action: deny`. It duplicates the token bucket on purpose: the
   firewall's count is per project rather than per instance, and it refuses before
   a function is invoked at all.
2. **Enable Attack Challenge Mode as a runbook step, not a default.** One switch,
   no code, no deploy. It is the correct first response to a flood in progress and
   the wrong permanent setting, because it challenges everybody.
3. **The managed OWASP ruleset in blocking mode** for the obvious request shapes:
   traversal, injection, and known scanner signatures. Managed, because a
   hand-written regex for SQL injection on a form that only ever reaches a
   parameterised RPC is maintenance with no threat behind it.
4. **A bot-filter rule for declared automation** — `user-agent` matching common
   library defaults (`curl`, `python-requests`, `Go-http-client`, `Scrapy`) on
   `POST /early-access` only. Cheap, honest about being trivially evaded, and it
   removes the least sophisticated traffic before it costs anything. Never applied
   to `GET`: the page should stay readable by anything, including archivers.
5. **A persistent action on repeated denials** so an address that has been refused
   many times keeps being refused, rather than being counted afresh each minute.

Deliberately **not** recommended:

- **Geographic blocking.** ASI OS is one person's product with no geographic
  market, so a country block is a guess about where interest comes from that
  refuses real people to inconvenience an attacker who moves. Geography is worth
  *alerting* on — a sudden concentration is a signal — and not worth blocking on.
- **Custom rules duplicating the managed ruleset.** They drift, and the managed one
  is updated by people whose job it is.
- **Anything that touches `GET /early-access`.** The page is public and should be
  readable, indexable and archivable. The write is the only thing worth guarding.

## 6. Failure modes

Every refusal says what happened to the submission and what is safe to do next,
and none names the layer that decided.

| Situation | What the visitor gets | Why |
| --- | --- | --- |
| Burst refused at the edge | `429`, a plain page saying nothing was saved, a `Retry-After`, and a link back to the form | It must work without JavaScript, where a refusal *is* the next page. It carries no styling from the application, because rendering React to say "wait a minute" is the wrong dependency |
| Body too large | `413`, the same page | The same reasoning |
| Rate limited by the database | The form, with the answers still in it, and an amber notice saying too many requests arrived from this connection and nothing was saved | Amber, not red: [Principle 11](PRINCIPLES.md#11-calm-by-default) reserves red for failure, and being early is not the visitor's mistake |
| Not configured | An amber notice saying requests are not being recorded and pointing at the repository | The deployment's fault, stated as such, with somewhere else to go |
| Key not recognised, or the write failed | One red sentence: it could not be recorded, nothing was saved, trying again is safe | The two are told apart in the log and not on the page. Which lock refused you is not information a page owes a stranger |
| An outcome this code does not recognise | The same red sentence | An answer we cannot interpret has not recorded anything as far as we can tell, and claiming otherwise is the one dishonest option |
| Honeypot filled | Exactly what a successful submission gets | Telling a bot which rule it tripped is how the next attempt gets past it |

Nothing in any of these paths includes a database message, a rule name, a
threshold, or a stack trace.

## 7. What is logged

One JSON line per submission, on stdout, or stderr for the outcomes worth
noticing:

```json
{"event":"early_access.intake","at":"2026-07-30T12:00:00.000Z",
 "correlationId":"…","outcome":"throttled","client":"7b1c…","durationMs":41}
```

- `outcome` — one of `accepted`, `throttled`, `burst`, `oversize`, `invalid`,
  `honeypot`, `refused`, `unconfigured`, `failed`.
- `client` — the keyed digest, absent for events raised at the edge, which has no
  key to compute one with.
- `fields` — the names of fields a submission failed on. Never their contents.
- `code` — a database error code where the call itself raised one, such as a lost
  connection. Never its message: a check violation is entitled to quote the row
  that caused it, and that row is somebody's answers. A submission the queue's own
  constraints refuse is answered `failed` with no code, because the function
  catches it in order to keep the count it spent; the `SQLSTATE` is raised as a
  PostgreSQL warning and so lands in the database log rather than this one.

There is no field for a name, an address, an email or a message. The record is a
closed shape in `lib/early-access/log.ts`, so adding one means editing the file
where the reason not to is written down, and
`tests/unit/early-access-action.test.ts` submits a full form and asserts that none
of it appears in the output.

Useful questions and the answers to look for:

| Question | What to look at |
| --- | --- |
| Is the form working? | A steady trickle of `accepted`, and no `unconfigured` |
| Did somebody forget the key? | `unconfigured`, or `refused` immediately after a deploy |
| Is something trying? | `throttled` and `burst`, and `select window_start, sum(admitted), sum(refused) from access.intake_counters where bucket <> 'deployment' group by window_start order by window_start desc` |
| How close is the deployment to its ceiling? | `select window_start, admitted, refused from access.intake_counters where bucket = 'deployment' order by window_start desc limit 24` |
| Is the form confusing? | `invalid` with the same `fields` over and over |

## 8. Residual risks, accepted knowingly

1. **A flood of invalid submissions costs CPU without touching the database.** The
   schema rejects them before any call is made, so they consume no rows and no
   round trips — but they do consume a function invocation. The token bucket and a
   firewall rate limit are the answers; a durable counter for requests that never
   reach the database was considered and rejected as a second round trip on every
   rejected form.
2. **The token bucket is per instance.** Stated in `lib/early-access/limits.ts` and
   here, and the reason the database's count exists.
3. **The global ceiling is a shared fate.** Two hundred *admitted* requests an
   hour from one actor refuses everybody else until the window turns over. Raising
   it trades that for a larger queue to clean; the ceiling is data so the trade can
   be made in the moment. What is no longer true is that refusals sustain it: only
   an admitted call increments `admitted`, so the cost of holding the door shut is
   two hundred rows an hour and not one request every eighteen seconds. Reaching it
   costs an attacker the same as reaching it legitimately.
4. **The intake key is a shared secret in two places.** If it leaks, an attacker
   regains the ability to write to the queue at the metered rate — not to read
   anything, and not to touch any other table. Rotation is one `UPDATE` and one
   environment variable.
5. **`content-length` is the client's own claim.** A body that understates its
   length is refused by `bodySizeLimit` rather than by the header check, one layer
   later and after being read.
6. **Only `/early-access` is guarded at the edge.** `/login` is rate limited by
   Supabase Auth rather than by this code. Worth revisiting if a firewall rule is
   added, since one rule could cover both.
7. **IPv4 is metered per address, not per network.** An actor holding many
   unrelated IPv4 addresses gets `per_client_max` from each, and the deployment
   ceiling is what stops them. Truncating to a /24 was considered and rejected:
   that block can be 256 unrelated subscribers of one carrier, so it would refuse
   strangers for each other's traffic to raise the cost of an attack that already
   requires buying addresses. The reasoning is in `lib/early-access/client-id.ts`
   beside the constant.
8. **Both windows are fixed, so a boundary can be straddled.** A caller who times
   it sends `per_client_max` in the last second of one window and again in the
   first second of the next. The edge token bucket caps how fast that can be done,
   and the design already had this property before the counters existed, because
   the caller's digest includes the UTC date and so reset at midnight.
9. **A visitor with no forwarded address shares one bucket with every other.**
   `clientBucket()` returns null for an absent or unparseable value and the digest
   falls back to a single `unattributed` bucket. Behind Vercel that is local
   traffic; behind nothing at all it means a forged `x-forwarded-for` buys one
   shared budget instead of a private one. Strict in the safe direction, and the
   reason a deployment that terminates its own TLS must not be trusted to populate
   that header.

## 9. Launch checklist

Before `/early-access` is public:

- [ ] `ASI_INTAKE_KEY` set in the production environment, generated by
      `npm run intake:key` and never written to a file.
- [ ] Its digest inserted into `access.intake_keys` in the production project, with
      a label naming the deployment.
- [ ] A real submission recorded end to end, confirmed by reading the row in the
      database.
- [ ] A second submission from the same address absorbed silently, with the first
      answer intact.
- [ ] `access` **not** listed in the project's exposed schemas — the comment in
      `supabase/config.toml` says so where someone would be tempted.
- [ ] `select count(*) from access.intake_keys where retired_at is null` returns
      exactly the keys in use.
- [ ] `access.intake_limits` holds one row, and its thresholds are the ones
      intended for launch.
- [ ] A direct `POST` to `/rest/v1/rpc/request_early_access` with the publishable
      key and no `p_key` is refused, and writes nothing.
- [ ] `npm run verify` green, including `tests/rls/intake-guard.test.ts` and
      `tests/rls/intake-concurrency.test.ts` — the second one submits in parallel
      on separate connections, which is the only way the meter's real behaviour
      shows up.
- [ ] `access.intake_attempts` gone and `access.intake_counters` present, which is
      how a project is known to have migration 0005.
- [ ] Vercel Firewall rate-limit rule on `POST /early-access`, and Attack Challenge
      Mode known to be one switch away.
- [ ] One submission's log line read in the platform's log view, and confirmed to
      contain no name, address or message.
- [ ] A `throttled` outcome seen at least once — lower `per_client_max` to 1,
      submit twice, put it back — so the page's amber notice is known to render.
