# Design Document

## Overview

### Goals

- Let a venue accept a promoter, give that promoter one unguessable link per
  venue, and record which Venue_Opens came through it.
- Derive a Payable_Arrival on the server from facts the server already
  trusts or has bounded, write it once, and count it against caps in one
  transaction.
- Lock one statement per venue, promoter and week on the existing Monday
  report pass, and bill GlyphCity's flat fee monthly through the existing
  Yoco hosted checkout.
- Fix the chained-reopen merge so a daytime look cannot erase an evening
  link.

### Non-Goals

- Paying the promoter. GlyphCity produces the statement; the venue pays.
- A company, employee, or desktop promoter workspace.
- Age verification. A self-tick only.
- Any boost code. `north-star-alignment` R8.2 release A ships first.
- Any change to beams, `vibeRank`, map membership, or the Receipt's gate.

### Binding constraints

- Serverless only. No new table, queue, Lambda or schedule. Every new row is
  in app-data (`pk`/`sk`, `GSI1`, `ttl`). The Monday pass and the Yoco
  checkout are reused.
- Handler to service to repository. `foundVia` and the payable decision are
  server-derived. The client never sends either.
- One home per concept: `attribution.ts` for constants and sources,
  `found-via.ts` for both gates, `venue-open.ts` for the row,
  `shared/qr/token.ts` for the QR token, `createYocoCheckout` for money.
- Frozen files (`eslint-lines-baseline.json`, `scripts/lines-ratchet.mjs`):
  `check-in/service.ts`, `business/service.ts`, `reports/generator.ts` each
  gain one call line. New logic lives in new files.
- Honest copy: every owner- and promoter-facing string goes through the
  honest-copy property test. Verb is "recorded". "spend" is banned.
- No coordinates stored or logged on this path.

## Architecture

### Component map

```
consumer web (apps/web)
  /node/{slug}?p={code}  ──Amplify rewrite──► GET /v1/share/node/:slug?p=   (OG + "Shared by")
                                              └─ redirect ► /map?venue={slug}&src=promoter&p={code}
  arrival effect ────────► POST /v1/nodes/:nodeId/open { source:'promoter', away, promoterCode }
                           ◄ { sharedBy: name | null }
  venue card (nightlife) ► 18+ tick ► PATCH /v1/users/me/adult-self-tick
  QrCheckIn ─────────────► requestLocation(); fresh fix or token alone, then POST /v1/check-in
  /promoter route ───────► promoter routes (below)

backend (API Lambda)
  check-in/venue-open.ts         stale chain replaced; row gains promoterLinkId
  check-in/found-via.ts          resolveFoundVia (unchanged for prior sources) + resolvePayable (new, pure)
  check-in/payable-facts.ts      gathers PayableFacts (new)
  check-in/payable-repository.ts transaction, cap mark, 30-day count (new)
  check-in/service.ts            one line: await recordPayableIfAny(...)
  promoter/                      new feature module (types, repository, service, handler)
  shared/qr/token.ts             one QR token implementation
  business/arrival-fee.ts        invoice, checkout, pause read (new)
  business/service.ts            webhook branch type === 'arrival_fee' (one call)
  reports/statements.ts          lockStatements, createArrivalFeeInvoice (new)
  reports/dispatcher.ts          WEEKCLAIM fan-out beside the existing weekly fan-out
  reports/generator.ts           one line per message type
  nodes/share-routes.ts          passes p through; OG description gains "Shared by"
  workers/cleanup.ts             erasure covers promoter rows

business web (apps/business)
  PromotersPanel (new)           switch, applications, rooms, rate/caps, claims, suggestions, statements
  LivePanel / CheckInDetail      badge from OPEN_SOURCE_PHRASE.promoter
  PlansPanel                     "Arrival fee due" card when an invoice is open
  TonightForm                    accepts a prefilled headline from a suggestion

admin web (apps/admin)
  PromotersScreen (new)          disable, clustering report, statement lookup
```

### Data model (app-data, no new table)

| Row           | pk                              | sk                                | gsi1pk                  | gsi1sk                   | Notes                                                                                     |
| ------------- | ------------------------------- | --------------------------------- | ----------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| Promoter      | `USER#{userId}`                 | `PROMOTER`                        | `PROMOTERS`             | `{createdAt}#{userId}`   | `displayName`, `disabledAt?`                                                              |
| Adult tick    | `USER#{userId}`                 | `ADULT_TICK`                      |                         |                          | `tickedAt`. One row for guests and promoters                                              |
| Application   | `NODE#{nodeId}`                 | `PAPP#{promoterId}`               | `PROMOTER#{promoterId}` | `PAPP#{nodeId}`          | `note` (max 200), `createdAt`, `ttl` 30 d                                                 |
| Affiliation   | `NODE#{nodeId}`                 | `PROM#{promoterId}`               | `PROMOTER#{promoterId}` | `PROM#{nodeId}`          | `rateCents`, `nightCap`, `weekCeilingCents`, `code`, `linkId`, `acceptedAt`, `droppedAt?` |
| Link          | `PLINK#{linkId}`                | `VALUE`                           |                         |                          | `promoterId`, `nodeId`, `revokedAt?`. `linkId = sha256(code)` hex                         |
| Claim         | `CLAIM#{nodeId}#{night}`        | `PROM#{promoterId}`               | `PROMOTER#{promoterId}` | `CLAIM#{night}#{nodeId}` | snapshot `rateCents`, `nightCap`, `weekCeilingCents`, `category`, `weekStart`, `ttl` 60 d |
| Week marker   | `WEEKCLAIM#{weekStart}`         | `BIZ#{businessId}`                |                         |                          | idempotent, `ttl` 60 d                                                                    |
| Night counter | `PCOUNT#{nodeId}#{promoterId}`  | `NIGHT#{night}`                   |                         |                          | `n`, `ttl` 60 d                                                                           |
| Week counter  | `PCOUNT#{nodeId}#{promoterId}`  | `WEEK#{weekStart}`                |                         |                          | `cents`, `ttl` 60 d                                                                       |
| Payable       | `PAYABLE#{nodeId}#{promoterId}` | `{weekStart}#{night}#{checkInId}` | `PAY#{promoterId}`      | `{night}#{checkInId}`    | R8.1 facts incl. `rateCents`, `feeCents`; no guest id                                     |
| Cap mark      | `PCAP#{nodeId}#{promoterId}`    | `NIGHT#{night}`                   |                         |                          | `reachedAt`, written once                                                                 |
| Suggestion    | `NODE#{nodeId}`                 | `TSUG#{date}#{promoterId}`        | `PROMOTER#{promoterId}` | `TSUG#{date}#{nodeId}`   | `headline`, `ttl` 15 d                                                                    |
| Statement     | `STMT#{nodeId}`                 | `{weekStart}#{promoterId}`        | `STMTP#{promoterId}`    | `{weekStart}#{nodeId}`   | locked lines, `promoterDisplayName`, `venueMark?`, `promoterMark?`                        |
| Invoice       | `AFINV#{businessId}`            | `{yyyy-mm}`                       |                         |                          | `count`, `feeCents`, `amountCents`, `dueAt`, `paidAt?`, `yocoCheckoutId?`                 |
| Audit         | `PAUDIT#{nodeId}`               | `{iso}#{ulid}`                    |                         |                          | `actor`, `action`, `before`, `after`                                                      |

Node record gains `acceptingPromoters: boolean` (default false) and
`promotersPerNight: number` (default 1). Nothing is added to the users
table.

Erasure is an explicit list, not a prefix scan. `deleteAppDataForUser`
(`workers/cleanup.ts`) deletes named partitions, and its
`referencingGsi1Partitions` array is where GSI1 coverage is added.
`PROMOTER#{userId}` goes on that list, which removes Applications,
Affiliations, Claims and Suggestions. Statements (`STMTP#`) and Payable
rows (`PAY#`) are not on the list; they are money rows with no guest id,
and the statement keeps the display-name snapshot (decision 25).

Definitions: `night = nightFor(instant)` (04:00 SAST rollover).
`weekStart = Monday (SAST) of the calendar date named by night`. A 01:00
Monday check-in is Sunday's night and belongs to the week that Sunday
closes. The Monday 06:00 pass locks that week.

## Phase 1: fixes the money depends on

### Chained-reopen merge

Built. `kvGet` drops a row past its TTL, so a single stale row is already
gone. The defect was a chain: open 09:00, re-open 14:00 (row merged,
`openedAt` stays 09:00, TTL reset), check-in 16:00. `resolveFoundVia` saw
age 7 h and returned `walk_in`, although the 14:00 open was a real away
look. Replacing the stored open only once it is more than the window older
than the incoming one does not fix that chain: at 14:00 the 09:00 look is
five hours old and stays first.

The row is now runs of `{ source, openedAt, lastOpenedAt, away }`, oldest
first, never overlapping (`check-in/venue-open.ts`, `check-in/found-via.ts`):

- `mergeVenueOpen` drops runs whose last open is older than the window
  measured back from the incoming open, extends the latest run when the
  incoming open has the same source and comes less than 20 minutes after
  it (ORing `away`), and otherwise appends a run. At 20 runs the incoming
  open is dropped, which can only under-claim.
- `resolveFoundVia` credits the earliest run with an open inside the window.
  A run whose first open aged out is credited on the time arm: its gaps are
  under 20 minutes, so its earliest in-window open is older than the window
  minus 20 minutes.
- Property 1 (`venue-open-merge.property.test.ts`) checks the folded row
  against a reference that keeps every open, for any sequence and any later
  check-in. `ATTRIBUTION_WINDOW_MS` and `AWAY_GATE_MIN_MS` live in
  `attribution.ts`.

For Phase 2 and 3: `promoterLinkId` sits on the run, and a run extends only
when source and `promoterLinkId` both match. `away` is ORed within a run, so
R4.1.3 (the open's `away` is `true`) must not read it for money: Phase 3
adds a per-run flag that is true only when every open in the run was away.

### One QR token module

Built. `backend/src/shared/qr/token.ts` holds `generateQrToken` and
`validateQrToken` (15-minute buckets, current and previous). Delete the
private copy in `check-in/service.ts` and the body in
`business/service.ts`; both import from shared. Write
`shared/qr/__tests__/token.test.ts` and repoint the expectations that live
in `business/__tests__/handler.test.ts` and `__tests__/data-integrity.test.ts`.
A grep test asserts `generateQrToken` and `validateQrToken` are defined
only in `shared/qr/token.ts`. `qrHmacSecret()` stays in `shared/config/env.ts`;
unsubscribe links and music OAuth keep calling it.

## Phase 2: promoter, link, source

### Constants (`packages/shared/constants/attribution.ts`)

- `OPEN_SOURCES` gains `'promoter'`; `FOUND_VIA` follows;
  `OPEN_SOURCE_PHRASE.promoter = 'from a promoter's link'`;
  `ATTRIBUTION_WINDOW_MS` exported.
- `PROMOTER_CODE_LENGTH = 16`. The private `generateToken` in
  `rewards/guest-claim.ts` (Crockford alphabet, `crypto.getRandomValues`)
  moves to `backend/src/shared/tokens/crockford.ts` taking a length; both
  callers import it.
- `CLAIM_CLOSE_HOUR_SAST = 16`, `CLAIM_HORIZON_DAYS = 14`,
  `PROMOTER_ROOMS_PER_NIGHT = 2`, `PROMOTER_ROOMS_HELD = 4`,
  `PAYABLE_LOOKBACK_DAYS = 30`.

`reports/types.ts` `receiptBySourceSchema` gains `promoter` as optional;
the fixtures in `receipt.test.ts`, `digest-pipeline-rehearsal.test.ts` and
`digest-repository.test.ts` that pin the exact object are updated.
`isOpenSource` in `found-via.ts` accepts the new source; the existing
property test is re-run with the assertion narrowed to "unchanged for the
four prior sources".

### Venue_Open row

Each `VenueOpenRun` gains `promoterLinkId?: string`. `venueOpenBodySchema` gains
`promoterCode?: string` (alphabet and length regex). Service:

1. If `source === 'promoter'` and a code is present, hash it and read
   `PLINK#{linkId}`. If the row exists, is not revoked, and `nodeId` matches
   the path, store `{ source: 'promoter', promoterLinkId }` and respond
   `{ sharedBy: displayName }`.
2. Otherwise store `source: 'share'` and respond `{ sharedBy: null }`. A
   bad or revoked code is an ordinary share.
3. The raw code is not stored on the open row and not logged by the
   service. It does travel in the URL; that residual is recorded below.

The response body is new (today 204). It carries the display name only.

### Share route and arrival

`GET /v1/share/node/:slug` accepts optional `p` (code regex). When valid
and live, the OG description is prefixed "Shared by {name} · " and the
redirect is `/map?venue={slug}&src=promoter&p={code}`; otherwise today's
behaviour. The route is already public and rate limited; no new endpoint.
`parseVenueArrival` reads `p`, the stash carries it, the arrival effect
passes it to `recordVenueOpen` and renders "Shared by {name}" on the venue
card from the open response.

### Promoter module (`backend/src/features/promoter/`)

Four files, each under 300 lines; the service is split by concern
(`service-affiliation.ts`, `service-claims.ts`, `service-statements.ts`)
if it would pass the limit. Handler order per `tech.md`.

Consumer routes (`requireAuth('consumer')`, rate limited):

- `POST /v1/promoter/me` body `{ adultSelfTick: true }`; writes the
  Promoter row and the Adult tick row; `false` is a 400.
- `GET /v1/promoter/me`: rooms (with `code`), pending applications, claims,
  tonight counts, cap marks, paused venues, statements (GSI1 `STMTP#`).
- `POST /v1/promoter/applications` `{ nodeId, note: string max 200 }`.
  Rejected unless `isMapEligibleBusiness` and the node's
  `acceptingPromoters`.
- `GET /v1/promoter/venues/:nodeId/track-record` returns
  `{ statements, venueMarkedPaid, promoterMarkedUnpaid }` counts.
- `POST /v1/promoter/claims` `{ nodeId, night }`; service enforces
  affiliation live, horizon, close hour, rooms per night, rooms held,
  category rule, node `promotersPerNight`; snapshots rate and caps; writes
  the Week marker.
- `DELETE /v1/promoter/claims/:nodeId/:night` before close only.
- `POST /v1/promoter/suggestions` `{ nodeId, date, headline }`.
- `POST /v1/promoter/statements/:nodeId/:weekStart/mark` `{ paid }`; the
  promoter id comes from auth and the update is conditional on
  `promoterId = :me`.

Business routes (`requireAuth('business')`, node ownership via the existing
node-for-business read):

- `PATCH /v1/business/nodes/:nodeId/promoter-settings`
  `{ acceptingPromoters, promotersPerNight }`.
- `GET /v1/business/nodes/:nodeId/promoters`: applications (with the
  applicant's other rooms), affiliations, claims by night, suggestions,
  statements, maximum owed this week.
- `POST .../applications/:promoterId/accept` `{ rateCents, nightCap, weekCeilingCents }`
  all required; writes Affiliation with `code`, writes Link.
- `POST .../promoters/:promoterId/drop`: `droppedAt`, Link `revokedAt`,
  future claims deleted, the current night's claim kept.
- `PATCH .../promoters/:promoterId` rate and caps; future claims only.
- `DELETE .../suggestions/:date/:promoterId` dismiss. There is no approve
  endpoint; the panel's "Use this headline" opens `TonightForm` prefilled.
- `POST .../statements/:weekStart/:promoterId/mark` `{ paid }`.

Admin routes (`requireAuth('admin')`): disable promoter (reason, max 280),
clustering report (GSI1 `PAY#{promoterId}` per promoter listed from the
`PROMOTERS` partition, date range capped at 367 days), statement by key.

Every mutation appends an Audit row. Every mutation control in every panel
is disabled while its request is in flight.

### Map eligibility, one helper

`nodes/repository.ts` gains `isMapEligibleBusiness(biz, node)` returning
the boolean `getNodesByCitySlug` filters on (stored tier in
`PAID_TIERS_SET`, `isActive`, `businessId` present). `getNodesByCitySlug`
is refactored to call it. The promoter service calls it through the
repository export.

## Phase 3: the payable decision

### `resolvePayable` (pure, `found-via.ts`)

```ts
export interface PayableFacts {
  foundVia: FoundVia
  open: VenueOpenRow | null
  checkInInstantIso: string // server now
  isReplay: boolean
  qrValid: boolean
  proximityAccepted: boolean | null // null when no position was sent
  guestIsPromoter: boolean
  priorCheckInsAtNode30d: number
  nodeCategory: NodeCategory
  adultTickAt: string | null
  nightlifeGateOn: boolean // prod true, dev false, per the decision doc
  mapEligible: boolean
  linkLiveAtOpen: boolean
  claimLive: boolean
  accrualPaused: boolean
}
export function resolvePayable(f: PayableFacts): { payable: true } | { payable: false; reason: PayableReason }
```

Reasons in order: `not_promoter`, `replay`, `under_20_minutes`,
`away_not_true`, `qr_missing`, `proximity_missing`, `proximity_failed`,
`self`, `recent_visitor`, `adult_tick_missing`, `not_on_map`,
`link_revoked`, `no_claim`, `paused`. Caps are enforced by the
transaction, not the predicate.

### Facts (`check-in/payable-facts.ts`)

Called from one line in `processCheckIn` after `insertCheckIn`, before the
socket emits, inside a try that logs at error level and never fails the
check-in (same posture as `readOpenRowForStamp`):

1. `qrValid` from step 2 of the pipeline.
2. `proximityAccepted`: when `lat`/`lng` arrived with a QR check-in, run
   the same `decideProximity` call as the GPS branch, keep `.accepted`,
   drop the coordinates. Absent position reads `null`.
3. `priorCheckInsAtNode30d` via a new
   `countCheckInsAtNodeSince(userId, nodeId, sinceMs)` in
   `check-in/dynamodb-repository.ts`: `UserIndex` key condition
   `timestamp >= :since`, filter `nodeId`, `Select: 'COUNT'`, paginated to
   completion. (`getRecentCheckInCount` reads one ascending page and would
   under-count a long history.) Called before the insert.
4. Link, claim, affiliation and pause reads come from the promoter
   feature through the dynamic-import seam already used for
   `rewards/threshold-lock`.
5. `adultTickAt` from `USER#{userId}` / `ADULT_TICK`.
6. `mapEligible` via `isMapEligibleBusiness`.
7. `accrualPaused` via `arrival-fee.isAccrualPaused(businessId)`: one
   Query on `AFINV#{businessId}` descending, limit 1; paused when unpaid
   and `dueAt < now`.

### Transaction (`check-in/payable-repository.ts`)

```ts
TransactWriteCommand({
  TransactItems: [
    { Update: NIGHT counter, 'ADD n :one', Condition: 'attribute_not_exists(n) OR n < :nightCap' },
    { Update: WEEK counter,  'ADD cents :rate', Condition: 'attribute_not_exists(cents) OR cents <= :ceilingMinusRate' },
    { Put: Payable row, Condition: 'attribute_not_exists(pk)' },
  ],
})
```

The week counter is in cents so two claims at different rates share one
ceiling (decision 22a). On `TransactionCanceledException` with a counter
condition failing, write the Cap mark once. On the Put condition failing
(duplicate check-in id), do nothing. Any other error is logged and the
check-in still succeeds.

### Client: position on QR check-in

`QrCheckIn.tsx` today posts in a mount effect with no geolocation. It calls
`requestLocation()` from `useGeolocation` (`packages/shared/hooks/useGeolocation.ts`),
which already resolves within its private 8 s `GPS_TIMEOUT`. Post `lat`,
`lng`, `accuracy` only when this call returns a fresh fix (`geoStatus`
`acquired` or `poorAccuracy`). On `timeout` or `denied`, or when the
promise resolves from the stored `lastKnownPosition`, post the token
alone: a stored fix can be from an earlier visit and must not count as
being at the venue now. Do not export `GPS_TIMEOUT`. The screen copy does
not change and does not mention payment. The existing 1.8 s success bounce
stays.

### Client: 18+ self-tick

A single checkbox "I am 18 or older" on the venue card for
`node.category === 'nightlife'` when the account has no tick, next to
"Shared by", and in Settings under Account. It calls
`PATCH /v1/users/me/adult-self-tick`. It never blocks check-in. Promoter
copy says a first nightlife arrival counts only when the tick predates it.

## Phase 4: statements and the fee

### Dispatch

`reports/dispatcher.ts` weekly handler, beside the existing per-business
fan-out, queries `WEEKCLAIM#{weekStart}` for the closed week and enqueues
one `{ kind: 'statements', businessId, weekStart }` message per marker.
This does not depend on node activity, so a demoted venue still gets its
lock (decision 26). On the first weekly pass whose `weekStart` falls in a
new month it also enqueues `{ kind: 'arrival_fee_invoice', businessId, period }`
for every business with a marker in the previous month.

### Lock (`reports/statements.ts`, called from one line in `generator.ts`)

For each node of the business and each promoter with a Claim in the week:
read Payable rows by `{weekStart}` prefix, group by `rateCents`, write the
Statement with lines `{ rateCents, count, owedCents }`, `totalOwedCents`,
`feeCents` per arrival and `totalFeeCents` (both `null` when the fee is
unset), `promoterDisplayName`, `lockedAt`. Conditional put on absence.
Zero count writes no row. Then `sendNotification` to the promoter
(`statement_ready`) and one line in the venue's digest email.

### Invoice (`business/arrival-fee.ts`)

`createArrivalFeeInvoice(businessId, period)`: sum Payable `feeCents`
across the business's nodes for the month; write `AFINV#{businessId}` /
`{period}` with `count`, `amountCents`, `dueAt = createdAt + SUBSCRIPTION_GRACE_DAYS`;
conditional on absence. When `readArrivalFeeCents()` returns `null` the
step logs `{ branch: 'arrival_fee_unset', businessId }` and writes nothing.

`readArrivalFeeCents()` reads `AREA_CODE_ARRIVAL_FEE_CENTS` and returns
`number | null`. The decided amount is 1000. Both Terraform environments
set `1000`. Unset still returns `null`: checkout is refused and no invoice
is written. The code does not substitute 1000. The variable is listed in
`rules/tech.md`. No tax is added to the amount.

### Checkout

`createYocoCheckout` is private in `business/service.ts`
(`amountCents`, `metadata`, `pathAfterReturn`). Add `export` to it (no new
lines in that frozen file) so `business/arrival-fee.ts`, same feature, can
call it. `POST /v1/business/me/arrival-fee/checkout` `{ period }` calls
`createYocoCheckout(amountCents, { businessId, type: 'arrival_fee', period }, '/plans')`.
`handlePaymentSucceeded` gains an explicit `type === 'arrival_fee'` branch
delegating to `arrival-fee.markInvoicePaid`; the subscription branch runs
only for `type === 'subscription'`; an unknown type logs at error level and
is acknowledged. `PlansPanel` shows an "Arrival fee due" card (period,
count, amount, Pay button disabled while loading); the existing
`?status=success` return refreshes it.

## Phase 5: surfaces

### Consumer `/promoter`

Mobile-first, 375 px, flex only, CSS variables, `rounded-2xl` cards, 44 px
controls, every mutation disabled in flight. Sections: Rooms (name, glyph,
Copy link, Copy post text, tonight count, cap mark, paused state, track
record before claiming), Nights (claim and unclaim within the horizon,
closed after 16:00), Suggestions (one input, 60 chars), Statements (week,
venue, lines, total owed, marks). Entry from Profile when the row exists,
"Become a promoter" in Settings otherwise.

Post text is plain text: venue name, Glyph_Name, the published Tonight
headline if any, the link, and the three guest lines from R2.5. No image is
generated; the existing Share_Preview supplies the preview where the link
is pasted.

### Business `PromotersPanel`

Added to `PANELS`, `PANEL_LABELS`, `PANEL_PERMISSIONS` in
`BusinessDashboard.tsx` and to the `DashboardPanel` union in
`packages/shared/stores/businessStore.ts`. Responsive. Sections: node
switch and per-night count, Applications (note, other rooms held, Accept
with the three required fields), Rooms (rate, caps, Drop), Nights (claims
per night), Suggestions ("Use this headline" opens `TonightForm`
prefilled; Dismiss), Statements (lines, total owed, fee line, Mark paid).
"Maximum owed this week" beside the caps.

### Admin `PromotersScreen`

Disable (reason), clustering report (payable rows with
`checkInAt - openedAt` between 20 and 25 minutes, per promoter, 367-day
cap), statement by key. Counts and ids only.

### Copy

Locale JSON per app. Measurement verbs only; "maximum owed", never "spend".
The honest-copy property test is extended to the new key prefixes.

## Security

- The client sends `promoterCode`, `qrToken`, optional position, and the
  tick. `foundVia`, `payable`, promoter id and reasons are server-derived.
- Codes are 16 Crockford characters; lookup is by SHA-256 hex; the code is
  stored on the Affiliation so the promoter page can render it.
- Position is read for a boolean and discarded. No log line on the payable
  path contains `lat` or `lng`; a unit test greps the two new modules.
- `capturedAt` sets `isReplay = true` and never moves the clock.
- Statement marks are keyed by node and week with the caller's id from
  auth and a conditional update. Application notes are bounded and
  rendered as text.
- Residuals, recorded, not patched: a modified client can send
  `away: true`; the code travels in a URL and so appears in API Gateway
  and Amplify access logs, browser history and the 5-minute share HTML
  cache.

## Privacy

- `legal-content.ts` gains one Privacy Policy section (R9.1).
- `AREA_CODE_CONSENT_VERSION` is bumped in the release that ships it;
  `needsReconsent` and `ReconsentGate` already prompt.
- Erasure: the `USER#` sweep removes the Promoter and Adult tick rows; the
  GSI1 sweep under `PROMOTER#{userId}` removes Applications, Affiliations,
  Claims and Suggestions; Link rows are deleted by the `linkId` on each
  Affiliation. Statements and Payable rows stay.

## Testing

Property tests (fast-check, 100 runs, block bodies), tagged
`Feature: Promoter arrivals, Property N`:

1. `mergeVenueOpen`: an incoming open more than the window after the
   existing one replaces it; inside the window behaviour is unchanged.
2. `resolvePayable`: rules, order, and the invariant that a payable result
   implies `foundVia === 'promoter'`, age at least 20 minutes,
   `away === true`, `qrValid`, `proximityAccepted === true`, `!isReplay`,
   `claimLive`.
3. `resolveFoundVia` unchanged for the four prior sources.
4. Transaction: one place left and two writers produce exactly one Payable
   row; a cents ceiling with two rates is never exceeded (in-memory
   transact mock as used by `going-repository` tests).
5. Statement lock is idempotent and its lines equal the grouped sum of
   Payable rows.
6. Honest copy over every new locale key.
7. No `lat`/`lng` in log calls within the two payable modules.

Playwright: promoter creates account, venue accepts, promoter copies link,
guest opens link logged out, signs in, lands on the card with "Shared by",
checks in by QR; business sees the badge; promoter sees the night total.

## Ship gates

1. `north-star-alignment` R8.2 release A live before Phase 2.
2. `docs/decisions/promoter-arrivals.md` is already recorded: 1000 cents,
   no tax line, nightlife withholding on in prod.
3. `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm format:check`,
   `pnpm guard:serverless`, `check-table-closure.mjs`,
   `scripts/lines-ratchet.mjs` green.
4. Consent bump executed as its own release step.
