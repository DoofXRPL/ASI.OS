# 0009 — The front door is gated and metered

- **Status:** Accepted
- **Date:** 2026-07-30
- **Amends:** [0008](0008-the-front-door-is-its-own-schema.md) §3 and its final
  consequence

## Context

ADR 0008 built the intake queue as something unreachable rather than merely
protected: its own schema, no privilege for any API role, and one `SECURITY
DEFINER` function as the way in. Then it granted `EXECUTE` on that function to
`anon`, which it had to — the visitor has no account.

That grant is the whole problem. `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` is in the
page source, by design, and with it anybody can post to
`/rest/v1/rpc/request_early_access` directly. So every check the Server Action
performs — the honeypot, the Zod schema, the body size limit — protects the path
a visitor happens to take, and none of them protects the path an attacker would
take instead. The queue was one script away from holding a million rows.

ADR 0008 closed with the position that abuse was "deterred rather than
prevented", and that a rate limiter would be infrastructure built without
evidence ([Principle 10](../PRINCIPLES.md)). Two things changed that reading:

1. The evidence for a public intake endpoint being abused does not need to be
   gathered from this endpoint. It is the ordinary condition of anonymous write
   endpoints on the public internet, and the cost of learning it here is a queue
   the owner has to clean rather than read.
2. The reasoning assumed a limiter needs a store. It does not need a *new* one.
   The counters are five integers and a timestamp, and PostgreSQL is already
   there.

## Decision

### 1. The function requires a key it can verify, and refuses without one

`public.request_early_access()` takes `p_key`, and refuses any call whose SHA-256
does not match an unretired row in `access.intake_keys`. The key lives as
`ASI_INTAKE_KEY` in the deployment's environment and as a digest in the database,
and in no third place.

This restores the property the Server Action's checks assumed: there is one way
in, and it goes through code we control. It is what makes every other layer worth
building.

**It is not a privileged credential and must never become one.** It grants
exactly one capability — call one insert-only function — and reads nothing. Row
Level Security is untouched by it, so it is not the service-role key under
another name, and `npm run guard:service-role` confines the variable to
`lib/early-access/intake-key.ts` and fails the build on any `NEXT_PUBLIC_`
spelling of it.

**The old signature is dropped rather than overloaded.** An overload keeping the
seven-argument form would leave the unguarded door standing next to the locked
one. PostgREST resolves a function by the arguments it is given, so `p_key` and
`p_client` have no defaults: a caller who omits them does not find a laxer
version of the function, they find nothing.

**A deployment with no key registered records nothing, and says so.** Failing
closed is the only safe direction, and it matches how the rest of the product
behaves when a variable is missing — `/login` names what it needs rather than
defaulting open.

### 2. The limits are counted in PostgreSQL, and configured as data

`access.intake_attempts` holds one row per call that got past the key check, and
`access.intake_limits` holds one row of thresholds: five per caller per fifteen
minutes, two hundred across the deployment per hour, remembered for a day.

Counting in the database rather than at the edge is what makes the count true.
Every instance of the deployment sees the same rows, so the limit does not divide
by however many instances are warm. Holding the thresholds as data rather than
constants means retuning the door is an `UPDATE`, which matters when the reason to
retune it is that something is happening right now. Every column is bounded, so
the door cannot be configured into being either shut or absent.

Refusals count towards the window as well as acceptances. A caller who keeps
knocking after being told to stop is the one case where extending the wait is the
right answer.

### 3. The counters hold a keyed digest, never an address

`client_hash` is an HMAC of the caller's address and the current UTC date under
the intake key, truncated to 32 hexadecimal characters. Three things follow:

- A plain hash of an IPv4 address is reversible by enumeration in seconds. A
  keyed one, under a key the database does not hold, is not.
- The date in the input means the same visitor is a different digest tomorrow, so
  a retained row identifies a bucket rather than a person.
- The column's check constraint accepts nothing but 32 hexadecimal characters, so
  an address cannot be stored there even by a caller trying to. The privacy
  promise is a constraint, not a convention in the calling code.

### 4. The function returns an outcome, and it is still not an oracle

`returns void` was chosen in ADR 0008 so the function could not report whether an
address was already listed. It now returns `accepted`, `throttled`, `refused` or
`unconfigured`, and the property is kept: a duplicate address is answered
`accepted` exactly as a new one is. What the extra outcomes distinguish is the
three situations a visitor deserves to be told apart — recorded, rate limited,
and not configured — which `void` forced the page to guess between.

### 5. The edge refuses what it can decide from the request line

The proxy refuses, before the session is refreshed and before any application code
runs:

- a `POST` to `/early-access` whose `content-length` exceeds 64 KB, with `413`;
- one that empties an in-memory token bucket — ten deep, refilling one token
  every six seconds — with `429` and a `Retry-After`.

Both are honest about being the weaker layer. The bucket lives in one instance's
memory, so a distributed flood spreads across several and each sees a fraction of
it; the count that holds is the one in PostgreSQL. It is here because it is free
and it stops the crude case in the cheapest available place. The address used as
the bucket key stays in volatile memory and is never logged or persisted.

`experimental.serverActions.bodySizeLimit` is set to the same 64 KB, replacing
Next.js's default megabyte. The longest field anywhere in the application is a
4000-character capture.

### 6. There is no CAPTCHA, and the reason is written down

Turnstile, hCaptcha and reCAPTCHA Enterprise were all considered and none is
being added. Each costs a third-party script on a page that currently loads none,
a new dependency, and an accessibility and progressive-enhancement problem: a
form that works with JavaScript disabled stops working, or the challenge becomes
advisory and therefore decorative.

The layers above make mass submission expensive without any of that. If evidence
arrives that they are not enough — a flood that gets through, rather than a
suspicion that one might — [docs/SECURITY.md](../SECURITY.md) records what to
reach for, in what order, and Turnstile is the third item rather than the first.

### 7. The log describes the door, not the people who came through it

Each submission emits one JSON line carrying a correlation id, a timestamp, an
outcome, the caller's digest, the names of any fields that failed, and a database
error code where there was one. There is no field for a name, an address, an
email or a message, and the record is a closed shape, so a call site cannot add
one by accident.

This is not the audit trail. `activity_events` belongs to an account and is read
by its owner; there is no account here, and the reader of these lines is whoever
is asking whether the form works.

## Consequences

- **A deployment now needs one more step, and a forgotten step is visible.** The
  key has to exist in the environment and its digest in the database.
  `npm run intake:key` prints both halves and connects to nothing, so applying
  the statement stays a decision made against the project the owner meant. Until
  both are done the form reports that requests are not being recorded, which is
  true.
- **Rotation is a deploy rather than an outage.** Several unretired keys may
  exist at once: register the new digest, ship the new environment, retire the
  old row.
- **The `access` schema now holds four tables rather than one.** The RLS suite
  enumerates them, so a fifth appearing without a test fails CI, exactly as a new
  table in `public` does.
- **A caller who cannot be metered is refused even with the right key.** An
  unmeterable request is an unlimited one, so the digest is checked before the
  key.
- **A global ceiling can refuse someone who has done nothing wrong.** That is the
  trade a ceiling makes, and it is the right way round: a flood that gets through
  is worse than a request that has to be sent again.
- **`lib/early-access/log.ts` is exempted from `no-console`.** It is the one
  module in the application whose purpose is to write a line to stdout, and the
  exemption is named in `eslint.config.mjs` rather than inline.
- **ADR 0008's last consequence no longer describes the product.** Its reasoning
  stands — a limiter needs a store, and new infrastructure needs evidence — and
  what changed is that the store turned out to be the one already here.
