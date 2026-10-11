# Requirements Document

## Introduction

GlyphCity is the live map of which rooms are actually busy. Venues pay to be
on that map. This spec adds a solo promoter: a person with a following who
posts about a room, and a venue who pays that person for arrivals recorded
through their link. GlyphCity counts those arrivals and charges the venue a
flat fee. GlyphCity does not hold the promoter's money and does not pay the
promoter.

The count rides on proof-of-demand. Found_You, the Away_Gate, the Receipt and
`BANNED_CAUSAL_VERBS` stay as they are. A payable arrival is a stricter subset.
The Receipt may record a find that the statement does not pay. That split is
intentional. The Receipt under-claims a reputation number. The statement is an
invoice.

This spec also fixes one defect the invoice depends on: a Venue_Open earlier
in the day can outlive the Attribution_Window and force a later open to
resolve as `walk_in`.

Relationship to sibling specs: extends `proof-of-demand` (same open row, same
gate, same Receipt) and `billing-revenue-integrity` (Yoco hosted checkout,
no card on file). Does not change `vibeRank`, beam brightness, map membership,
or the four auth contexts.

## North star

GlyphCity is the live map of which rooms are actually busy. Every requirement
in this spec, and every task derived from it, must do one of two things:

1. Make the map more truthful about who is in the room.
2. Let a venue pay for arrivals it can verify.

A task that does neither is a gimmick and is dropped, not deferred. The guest
gets no bonus for using a promoter link; a guest incentive would turn the loop
into a deals market and fight the map.

## Glossary

- **Promoter**: a consumer account with a promoter record. Not a new Cognito
  pool, not a staff account, not a venue.
- **Promoter_Link**: an unguessable code bound to one promoter and one venue.
  It is a public URL capability, not a secret: it is stored as written so the
  promoter page can render it again, and it is revoked by a flag. Ordinary
  shares stay anonymous.
- **Open_Source `promoter`**: a new source beside `map`, `share`, `search`,
  `push`. Receipt phrase: "from a promoter's link". Never a claim that
  GlyphCity or the promoter brought anyone.
- **Payable_Arrival**: a check-in that passes every pay rule in Requirement 4.
  Server-derived. The client cannot set it.
- **Night**: the existing product night, 04:00 SAST to 04:00 SAST
  (`nightFor` in `packages/shared/lib/sast.ts`).
- **Statement**: the Monday invoice for one venue and one promoter. Counts,
  rate, amount the venue owes the promoter, and GlyphCity's fee on its own
  line. Locks. After lock it does not change.
- **Ceiling**: a rand cap the venue sets for a promoter-week. A limit, not a
  wallet. Accrual pauses at zero remaining. No money sits with GlyphCity.
- **Arrival_Fee**: a flat rand amount per Payable_Arrival, owed by the venue
  to GlyphCity. Not a percentage of the promoter's rate.

## Out of scope

Permanent for this spec:

- A promotions company, employees, or a desktop company workspace. Follow-up
  spec after a solo promoter has completed a locked statement on a real night.
- Payout rails, EFT, KYC, FICA, or GlyphCity paying a promoter.
- A fifth auth context or a fifth portal.
- Changing beam brightness, `vibeRank`, or which venues appear on the map.
- Lengthening the Attribution_Window past 6 hours.
- Trusting a timestamp from before the guest had an account.
- A device graph to catch a second phone.
- Proving age. The 18+ control is a self-tick. It is not verification.
- A deals catalogue, a promoter feed, or a fifth consumer tab.
- Storing who sent an ordinary share.
- Any boost code. Boost retirement (`north-star-alignment` R8.2 release A)
  ships before Phase 2 of this spec, so no claimed-night boost rule is
  needed here.

## Locked decisions

1. Paid map membership is required. The gate is the existing map-membership
   rule (paid stored tier plus active node). No second definition of "paid".
2. First authenticated open inside the Attribution_Window keeps the source.
   Promoters are told: if the guest already opened this venue on GlyphCity
   in the last six hours, the arrival is not theirs.
3. The Receipt keeps today's Away_Gate, including the client `away === true`
   shortcut. A Payable_Arrival does not use that shortcut.
4. A Payable_Arrival always needs the 20-minute arm. `away === true` does
   not shorten it. `away === false` never pays. `away === null` never pays.
   A lied `away === true` can still pass. The location flag is a disqualifier,
   not proof.
5. A Payable_Arrival needs a valid venue QR token and a proximity pass at
   server time, together. GPS-only and QR-only check-ins still succeed as
   check-ins. They do not pay.
6. Proximity for pay uses the same decision GPS check-in already enforces
   (`decideProximity` under the current mode). No second radius. Coordinates
   are not stored and not logged.
7. Offline replay never pays. `capturedAt` is ignored for the payable
   decision. Server time is the check-in instant.
8. The promoter's own account never pays. A second phone is an accepted
   residual. Do not build a device graph.
9. A guest with any check-in at that venue in the previous 30 days, by any
   route, does not pay. Rolling 30 days from server time. The current
   check-in is excluded from the lookback.
10. Caps: 2 rooms on one night (the second in a different `NodeCategory`),
    and 4 rooms claimed at once across upcoming nights. Venue sets the rand
    rate, the per-night arrival cap, and the week ceiling.
11. Hitting the arrival cap does not unclaim the night. Boosts no longer
    exist when Phase 2 ships (see Out of scope).
12. Neither the venue nor the promoter can pause the other's counting. The
    venue drops the promoter. The promoter stops claiming nights. GlyphCity
    pauses accrual only when its own Arrival_Fee checkout is unpaid past the
    existing payment grace. Paying that checkout resumes accrual.
13. GlyphCity's fee stays owed on Payable_Arrivals already recorded, including
    when the venue and promoter disagree about the promoter's payment.
14. Dropping a promoter revokes the link. An open recorded while the link was
    live can still become a Payable_Arrival inside the window, inside the
    ceiling.
15. The statement locks inside the existing Monday report pass
    (`report-weekly`, `cron(0 4 ? * MON *)`, 06:00 SAST), after the 04:00
    rollover has closed Sunday's night. No new scheduler. The monthly
    Arrival_Fee invoice is created on the first weekly pass after a month
    ends, in the same run.
16. Copy verb is "recorded". `BANNED_CAUSAL_VERBS` stay banned, including
    "brought".
17. The Arrival_Fee is 1000 cents (R10) per Payable_Arrival, the whole
    charge, with no tax line. Recorded in
    `docs/decisions/promoter-arrivals.md`. A missing env var refuses
    checkout. Kiro does not invent a different price.
18. A night may be claimed up to 14 days ahead, the same horizon as Tonight.
    Claims close at 16:00 SAST on the night's date (`CLAIM_CLOSE_HOUR_SAST`).
    After close, no claim, unclaim, or rate change applies to that night.
19. A venue sets how many promoters may hold one night, default 1. The venue
    sees the maximum it could owe across all of them for the week.
20. A claim may be cancelled by the promoter before close. Dropping a
    promoter cancels their future claims and keeps the current night's
    claim, so an open recorded while the link was live can still pay
    (decision 14).
21. The rate, night cap, and week ceiling are copied onto the claim when it
    is made. Later changes affect only future claims. The promoter sees the
    rate before claiming and never sees the rand ceiling, only whether
    tonight is still counting.
22. Link, claim, rate, caps, statement, the accepting switch and the
    per-night count are per node, not per business.
    22a. The week ceiling is enforced in cents, not arrivals: the week counter
    accumulates `rateCents` per Payable_Arrival and refuses when the next
    arrival would exceed `weekCeilingCents`. Two claims at different rates in
    one week share one counter.
    22b. A Payable_Arrival requires a live Claim by that promoter at that node
    for `nightFor(checkInAt)`.
23. The 18+ self-tick is stored once per guest account with a timestamp, not
    per check-in. Account deletion removes it.
24. A week with zero Payable_Arrivals issues no statement. The promoter still
    sees zero per night.
25. A promoter who deletes their account mid-week still gets a locked
    statement on Monday, with the display name snapshotted at lock.
26. A venue that drops off the map mid-week stops accruing at that instant.
    Arrivals already recorded still lock and the Arrival_Fee is still owed.
27. All money is integer cents. Totals are count times rate. No rounding
    step, no proration.
28. Admin can disable a promoter. Every link is revoked, no new claims,
    locked statements stand. Admin sees a clustering report (arrivals 20 to
    25 minutes after the open, per promoter). The report informs a disable
    and never pauses anything on its own.
29. The staff validator app is unchanged. The promoter page is web only; the
    Expo app gets parity in a follow-up. New strings go through i18next.

## Requirements

### Requirement 1: Product boundary

**User story:** As a founder, I want one added loop, so the map stays the
product and the promoter is a voice on top of it.

#### Acceptance criteria

1. THE consumer app SHALL keep four tabs (Map, Ranks, Feed, Profile). The
   promoter surface is a route on the consumer app, reached from Profile.
2. THE venue's only paid lever for a night SHALL be the bounty. This holds
   by construction once `north-star-alignment` R8.2 has removed boosts;
   Phase 2 of this spec SHALL NOT ship before that release.
3. THE membership fee SHALL stay the charge for being on the map. The
   Arrival_Fee SHALL be a separate line. The promoter's rate SHALL be paid
   by the venue to the promoter, outside GlyphCity.
4. THE public map, beam brightness, and `vibeRank` SHALL be unchanged by a
   promoter, a claim, a cap, or a Payable_Arrival.

### Requirement 2: People and what they see

**User story:** As a guest, a promoter, and a venue, I want each of us to see
only the part of the count we are party to.

#### Acceptance criteria

1. A promoter SHALL be a consumer account plus a promoter record. Creating
   that record SHALL require an 18+ self-tick.
2. BEFORE a venue accepts a promoter, THE venue SHALL see the other rooms
   that promoter currently holds.
3. BEFORE a promoter claims a night, THE promoter SHALL see that venue's
   track record as three counts over locked statements: statements issued,
   marked paid by the venue, marked not paid by a promoter. No other
   promoter is named. Marks SHALL NOT pause accrual.
4. THE guest opening a Promoter_Link SHALL see "Shared by {promoter name}"
   before check-in.
5. THE promoter card SHALL say to open the link in the phone's browser, that
   a new guest must sign up before leaving home, and that an 18+ tick is
   required at a nightlife venue before an arrival can pay.
6. THE post text SHALL show the venue name and glyph. A Tonight headline
   SHALL appear only when the venue has published a Dated_Slot for that
   date. The promoter may send a headline suggestion (max 60 characters,
   `HEADLINE_MAX_LENGTH`); the venue acts on it by opening the existing
   `TonightForm` prefilled with that headline and publishing as today, or
   dismissing it. No approve endpoint writes a slot. One schedule store.
7. THE venue check-in row for `foundVia === promoter` SHALL read "from a
   promoter's link" and SHALL NOT name the promoter.
8. THE promoter surface SHALL show nightly totals only. No guest names, no
   check-in times, no rows.
9. THE Receipt SHALL keep the Suppression_Floor. Below the floor the source
   sentence stays hidden. THE Statement SHALL show the exact payable count,
   including one.
10. WHEN a guest deletes their account, THE 30-day lookback rows that identify
    them SHALL be removed. A locked Statement SHALL keep its counts and SHALL
    NOT keep that guest's identity.

### Requirement 3: The link and the open

**User story:** As a promoter, I want the first real look to count, so a
morning browse cannot erase the link I post that night.

#### Acceptance criteria

1. ONLY a Promoter_Link SHALL record a sender. An ordinary share SHALL stay
   source `share` with no identity.
   1a. A node SHALL have an "accepting promoters" switch, off by default. While
   off, no promoter can apply and no link can be created. Turning it off
   SHALL NOT revoke links already accepted; dropping does that. A Promoter_Link
   SHALL exist only after the venue accepts that promoter. The server SHALL
   generate the code. A promoter SHALL NOT be able to create, restore, or
   re-enable a link. The code is a capability URL: it is stored on the
   Affiliation so the promoter page can render it, and looked up by its
   hash. A database leak exposes links, not money; money still needs real
   arrivals under caps.
2. THE client SHALL send the link code. THE server SHALL resolve it to the
   promoter and venue. A raw user id SHALL be rejected.
3. WHEN the link is revoked, further opens SHALL NOT record source `promoter`
   for that pair.
4. THE Venue_Open row SHALL gain one optional promoter reference, the hash
   id of the link, and nothing else. No coordinates, no device id, no guest
   display name.
5. THE check-in SHALL be credited to the earliest open still inside the
   Attribution_Window at check-in time, so a look that aged out never hides
   a later one. The row SHALL keep every open that can still be credited, as
   runs: consecutive opens from the same source less than 20 minutes apart.
   `away` SHALL keep the existing three-valued OR within a run. This fix
   applies to every Open_Source, not only `promoter`. (Replacing the stored
   open only once it is past the window was rejected: open 09:00, reopen
   14:00, check in 16:00 still reads seven hours and stamps `walk_in`.)
6. THE open endpoint SHALL stay authenticated. The 6-hour and 20-minute
   clocks SHALL start at `recordVenueOpen`, which is after the guest has an
   account. A logged-out tap SHALL NOT start them.
7. THE existing sessionStorage stash MAY carry the code through sign-in in
   the same tab. Copy SHALL tell promoters that sign-up at the door does not
   pay, and that a private-mode browser can lose the stash.

### Requirement 4: Payable arrival

**User story:** As a venue, I want to pay only for a guest the rules can
defend, so a photo of the QR code or a queue at the door does not become a
bill.

#### Acceptance criteria

1. A check-in SHALL be a Payable_Arrival only when ALL of the following hold.
   Any miss SHALL leave a normal check-in and SHALL NOT pay:
   1. `foundVia` is `promoter`, from the earliest open in the window.
   2. That open was at least 20 minutes before server check-in time.
   3. The open's `away` is `true`. `false` and `null` do not pay. `true`
      does not waive the 20 minutes.
   4. The check-in presents a valid QR token for that node and passes
      `decideProximity` at server time.
   5. The check-in is not an offline replay.
   6. The guest is not the promoter's user id.
   7. The guest has no earlier check-in at that venue in the last 30 days.
   8. At a `nightlife` node, the guest's account carries an 18+ self-tick
      dated before the check-in. The tick is offered on the venue card
      (where "Shared by" renders) and in Settings, never on the QR screen,
      which does not know the node and leaves 1.8 s after success.
   9. The venue is map-eligible at server time.
   10. The link was live at open time.
   11. The night cap and the week ceiling (in cents) are not already met.
   12. Accrual is not paused for an unpaid Arrival_Fee.
   13. A live Claim exists for that promoter, node and night.
2. THE payable decision SHALL be a pure function of those facts, with
   property tests. THE Receipt's `resolveFoundVia` SHALL NOT call it, and it
   SHALL NOT call `resolveFoundVia` to weaken the Receipt.
3. TWO check-ins at the same moment SHALL NOT both pass a cap that has one
   place left. The night counter, the week counter, and the payable row
   SHALL be written in one DynamoDB transaction with conditions, so either
   all three land or none does.
4. A second delivery of the same check-in SHALL NOT create a second payable
   row.
5. THE promoter SHALL see "cap reached" when the night cap or the ceiling
   stops accrual, including the time of the night cap.

### Requirement 5: Code homes

**User story:** As a developer, I want each new rule to live in the file that
already owns that idea, so this spec does not grow a second stack.

#### Acceptance criteria

1. Open sources, the Receipt phrase, and the 20-minute and 6-hour constants
   SHALL stay in `packages/shared/constants/attribution.ts`, extended in
   place. `ACQUISITION_SOURCES` SHALL stay a first-touch label and SHALL NOT
   feed `foundVia` or the payable decision.
2. THE merge fix SHALL land in `mergeVenueOpen`
   (`backend/src/features/check-in/venue-open.ts`), using
   `ATTRIBUTION_WINDOW_MS` exported from `attribution.ts` (today it is
   private to `found-via.ts`).
3. THE payable predicate SHALL live next to `resolveFoundVia` in
   `backend/src/features/check-in/found-via.ts` as a separate function.
   Fact gathering and the transaction SHALL live in new files
   (`check-in/payable-facts.ts`, `check-in/payable-repository.ts`), never
   grown into `check-in/service.ts`, `business/service.ts` or
   `reports/generator.ts`, which are frozen by `eslint-lines-baseline.json`
   and `scripts/lines-ratchet.mjs`. Each frozen file gains one call line,
   offset by the QR-copy removal in 5.4.
   3a. THE one cross-feature call (check-in to promoter reads) SHALL use the
   dynamic-import seam already used at `check-in/service.ts` for
   `rewards/threshold-lock`, and nothing else from another feature's
   service.
4. QR validation SHALL have one implementation, in
   `backend/src/shared/qr/token.ts` (`generateQrToken`, `validateQrToken`).
   The private copy in `backend/src/features/check-in/service.ts` and the
   export in `backend/src/features/business/service.ts` SHALL both import
   from it. Features SHALL NOT import each other's services for this.
5. A normal QR check-in SHALL still succeed with no location. The location
   requirement SHALL apply only to the payable decision.
6. THE Receipt copy SHALL stay in `receipt-copy.ts`. The new phrase SHALL go
   through `OPEN_SOURCE_PHRASE`. The honest-copy property test SHALL cover
   every new owner-facing and promoter-facing string.
7. THE Arrival_Fee checkout SHALL use `createYocoCheckout` in
   `backend/src/features/business/service.ts`. No second payment client.
8. Privacy copy SHALL be updated in `packages/shared/constants/legal-content.ts`.
   The consent bump SHALL use `AREA_CODE_CONSENT_VERSION`. No second version
   source.
9. Night boundaries SHALL use `nightFor`. The statement lock SHALL run inside
   the existing digest pass. No new EventBridge rule.
10. A promoter's headline suggestion SHALL be a pending row in app-data.
    The venue publishes through the existing `TonightForm`; the suggestion
    only prefills it. No draft state on the slot, no second schedule table.
11. `receiptBySourceSchema` in `reports/types.ts` spells out the sources on
    purpose; `promoter` SHALL be added as optional so pre-spec Digest_Rows
    still parse, and the fixtures that pin the exact object SHALL be
    updated.
12. THE weekly dispatcher skips businesses with no active node, so it
    cannot be the trigger for statements of a demoted venue (decision 26).
    Writing a Claim SHALL also write an idempotent `WEEKCLAIM#{weekStart}`
    / `BIZ#{businessId}` marker; the Monday pass SHALL query that partition
    and enqueue a statements message per business, independent of node
    activity.

### Requirement 6: Security

**User story:** As an operator, I want the guest's phone unable to mint a
rand, so the only payable facts are ones the server already trusts or has
bounded.

#### Acceptance criteria

1. THE client SHALL NOT be able to submit `foundVia`, a payable flag, or a
   promoter user id.
2. Link codes SHALL be unguessable, stored hashed, and revoked on drop.
3. Payable proximity SHALL discard coordinates after the boolean decision.
   Logs for this path SHALL NOT contain latitude, longitude, or a device id.
4. Replay and a client-supplied `capturedAt` SHALL NOT move the payable
   clock.
5. A promoter SHALL read only their own totals and their own statements. A
   venue SHALL read statements for its own rooms. Neither SHALL receive the
   other's guest list joined to a promoter name.
6. Rate limits on open and check-in SHALL stay in force. The payable path
   SHALL NOT add a public unauthenticated endpoint. "Shared by {name}" is
   served by the existing public share route (already rate limited) and by
   the authenticated open response.
7. THE known residuals SHALL be documented in the design, not patched with a
   second store: a modified client can send `away: true`; and the code
   travels in a URL, so it appears in gateway and hosting access logs,
   browser history and the share HTML cache. Money rests on the 20-minute
   wait, the QR token, the proximity pass, the 30-day lookback, the live
   Claim and the caps.

### Requirement 7: Finance

**User story:** As a venue and a promoter, I want one bill I can reconcile,
and I want GlyphCity's cut to be boring.

#### Acceptance criteria

1. THE venue SHALL set the rand rate per Payable_Arrival, the night cap, and
   the week ceiling in cents, before a night can be claimed. Unset rate
   SHALL mean no accrual. Owner copy SHALL say "maximum owed", never
   "spend" (the honest-copy test forbids it).
2. THE Statement SHALL show: payable count, rate, amount the venue owes the
   promoter, and the Arrival_Fee as its own line. Wording SHALL be
   "arrivals recorded through your link".
3. THE Statement SHALL lock on the Monday digest run. Later deletion,
   revocation, or a payment mark SHALL NOT change locked figures.
4. THE venue and the promoter MAY each mark a locked statement paid or not
   paid. The marks are a track record. They SHALL NOT edit the figures and
   SHALL NOT pause accrual.
5. GlyphCity SHALL sum the Arrival_Fee for a calendar month and charge it
   with one Yoco hosted checkout. There is no card on file. A failed or
   abandoned checkout SHALL NOT be retried by a new rail.
6. WHEN the existing payment grace passes with that invoice unpaid, accrual
   for that venue's promoters SHALL pause. "Overdue" SHALL be computed at
   read time from the invoice's due date; no worker flips a flag. THE promoter SHALL see "counting
   paused" and SHALL NOT see the venue's payment error. A successful checkout
   SHALL resume accrual. Paused time SHALL NOT be back-filled.
7. A dispute about the promoter's cash SHALL NOT void, refund, or delay the
   Arrival_Fee for arrivals already on a statement.
8. THE Arrival_Fee SHALL be a flat amount per Payable_Arrival. It SHALL NOT
   be a percentage of the venue's rate.
9. UNTIL Requirement 11 sets the amount, THE checkout SHALL refuse to be
   created. Counting and statements MAY still run so a night can be rehearsed.
   No default price.

### Requirement 8: Audit

**User story:** As an auditor, I want every rand to point at a stored
decision, so a Monday statement can be rebuilt without trusting the screen.

#### Acceptance criteria

1. EACH Payable_Arrival SHALL store: check-in id, venue id, promoter id,
   night, week start, open time, check-in server time, `away` value,
   QR-valid boolean, proximity-accepted boolean, nightlife tick boolean,
   `rateCents` and `feeCents` as they stood, and the cap counters after the
   write. No coordinates, no guest id.
2. THE row SHALL be written once, keyed so a duplicate check-in id cannot
   insert again.
3. Accept, drop, rate, night cap, ceiling, claim, and unclaim SHALL each
   append an audit row: actor, action, before, after, time.
4. A locked Statement SHALL store the figures and the fee rate used. A later
   change to the Arrival_Fee constant SHALL NOT rewrite it.
5. AN operator SHALL be able to rebuild a statement from payable rows plus
   the lock row alone.
6. THE admin surface SHALL show counts and ids. It SHALL NOT become a guest
   browser.

### Requirement 9: Regulators and privacy

**User story:** As a POPIA-responsible operator, I want this purpose named,
minimised, and erasable, so a check-in that creates money for a third party
is not a silent use.

#### Acceptance criteria

1. THE privacy policy SHALL gain one purpose: a check-in that meets the pay
   rules can add to a promoter's count and to the venue's statement. It SHALL
   say the promoter sees counts, not identity, and that the venue's guest row
   does not name the promoter.
2. SHIPPING that purpose SHALL bump `AREA_CODE_CONSENT_VERSION` so existing
   guests re-consent. The bump is a deliberate release step, because it
   prompts every signed-in guest.
3. Position SHALL be used to decide proximity and then discarded, matching
   the existing check-in posture.
4. THE 18+ control SHALL be stored as a self-tick, never as a date of birth.
   THE product SHALL NOT describe it as age verification.
5. NIGHTLIFE enforcement of the tick SHALL be on in prod. The review is
   recorded in `docs/decisions/promoter-arrivals.md`: a missing tick does
   not count, the check-in still succeeds, and the product does not say
   GlyphCity verified age. Prod sets `AREA_CODE_FLAG_NIGHTLIFE_TICK` to
   `true`. Dev sets it to `false`. A missing value in prod refuses to
   start.
6. THIS spec SHALL NOT make GlyphCity the promoter's employer, payer, or
   tax withholding agent. No IRP5, no payroll run, no promoter bank details.
7. THE statement line SHALL show the configured fee and no tax line.
   Code SHALL NOT add VAT. Requirement 11 records R10 as the whole charge.

### Requirement 10: Removals and refusals

**User story:** As a founder, I want the spec to say what must not appear, so
a later task cannot "complete" the loop by adding a payments company.

#### Acceptance criteria

1. THE implementation SHALL NOT add a Cognito pool, an app, or a role named
   company, agency, or employee.
2. THE implementation SHALL NOT store promoter identity on ordinary shares.
3. THE implementation SHALL NOT pay a GPS-only check-in, a QR-only check-in,
   a replay, an unknown location, a known at-venue open, or the promoter's
   own account.
4. THE implementation SHALL NOT add any boost code or boost rule. Boosts are
   gone before Phase 2 (`north-star-alignment` R8.2 release A).
5. THE implementation SHALL NOT hold a bounty balance, store bank details, or
   send money to a promoter.
6. THE implementation SHALL NOT put the promoter's name into Receipt copy or
   into the venue's check-in row.
7. THE implementation SHALL NOT extend Attribution_Window, weaken
   `resolveFoundVia`, or brighten a beam because a promoter is attached.

### Requirement 11: Founder gates, decided

Recorded in `docs/decisions/promoter-arrivals.md` on 2026-10-11. Kiro
SHALL implement the recorded values and SHALL NOT reopen them.

1. **Arrival_Fee amount**: 1000 cents, flat per Payable_Arrival. Prod and
   dev Terraform set `AREA_CODE_ARRIVAL_FEE_CENTS` to `1000`. Unset refuses
   checkout and writes no invoice.
2. **VAT**: no tax line. R10 is the whole charge. Code SHALL NOT add VAT.
   A later registration is a new decision.
3. **Liquor review**: yes. Nightlife nodes withhold the payable when the
   18+ tick is missing. The venue keeps the licence duty. The product
   SHALL NOT say GlyphCity verified age.

## Ship order

1. Merge fix and single QR validator. Receipt behaviour inside the window
   stays. Opens older than the window stop poisoning later opens.
2. Promoter record, link, source, card, headline suggestion, guest notice.
   Waits on `north-star-alignment` R8.2 release A.
3. Payable predicate, atomic caps, statement, track-record marks.
4. Privacy copy and consent bump, coordinated with release.
5. Arrival_Fee checkout at 1000 cents, no tax line.
6. Nightlife tick enforcement on in prod.

Company workspace is not a step in this order.
