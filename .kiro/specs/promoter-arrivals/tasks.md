# Implementation Plan: Promoter Arrivals

## Overview

Six phases (0 to 5) in order. Phase 1 fixes two defects the money depends
on and ships on its own. Phase 2 adds the promoter, the link and the source
with no money attached, and waits for `north-star-alignment` R8.2 release A.
Phase 3 adds the payable decision and the transaction. Phase 4 adds
statements and the fee. Phase 5 is surfaces, privacy and rehearsal. No new
infrastructure at any step.

Property tests use fast-check, min 100 runs, block-statement predicates,
tagged `Feature: Promoter arrivals, Property N: <desc>`. Code limits in
`code-style.md` apply. Frozen files gain one call line each.

## Tasks

### Phase 0: decisions

- [x] 0. Founder decisions (R11)
  - [x] 0.1 `docs/decisions/promoter-arrivals.md` records R10 (1000 cents),
        no tax line, and nightlife withholding. Kiro implements those
        values and does not reopen them.
    - _Requirements: 11.1, 11.2, 11.3_

### Phase 1: fixes the money depends on

- [x] 1. Chained-reopen merge (R3.5, R5.2)
  - [x] 1.1 Export `ATTRIBUTION_WINDOW_MS` from `attribution.ts`; import it
        in `found-via.ts` and `venue-open.ts`
    - _Requirements: 5.1, 5.2_
  - [x] 1.2 Row as runs; `mergeVenueOpen` drops aged runs and folds
        same-source opens under 20 minutes apart; `resolveFoundVia`
        credits the earliest open still in the window
    - _Requirements: 3.5_
  - [x] 1.3 Property 1 in `venue-open-merge.property.test.ts`, against a
        full-history reference
    - _Requirements: 3.5_

- [x] 2. One QR token module (R5.4)
  - [x] 2.1 `backend/src/shared/qr/token.ts`; delete the private copy in
        `check-in/service.ts` and the body in `business/service.ts`; both
        import from shared; `shared/qr/__tests__/token.test.ts`. Neither
        `business/__tests__/handler.test.ts` nor
        `__tests__/data-integrity.test.ts` referenced the token functions,
        so neither needed repointing
    - _Requirements: 5.4_
  - [x] 2.2 Grep test: `generateQrToken` and `validateQrToken` defined only
        in `shared/qr/token.ts`. `qrHmacSecret()` stays in `env.ts`
    - _Requirements: 5.4_

### Phase 2: promoter, link, source (no money)

- [ ] 3. Constants, schema, generator (R5.1, R5.11)
  - [ ] 3.1 `attribution.ts`: `'promoter'` in `OPEN_SOURCES`,
        `OPEN_SOURCE_PHRASE.promoter`, `PROMOTER_CODE_LENGTH`,
        `CLAIM_CLOSE_HOUR_SAST`, `CLAIM_HORIZON_DAYS`,
        `PROMOTER_ROOMS_PER_NIGHT`, `PROMOTER_ROOMS_HELD`,
        `PAYABLE_LOOKBACK_DAYS`; `VenueOpenRow.promoterLinkId?`
    - _Requirements: 5.1_
  - [ ] 3.2 Move `generateToken` from `rewards/guest-claim.ts` to
        `backend/src/shared/tokens/crockford.ts` with a length parameter;
        both callers import it
    - _Requirements: 6.2_
  - [ ] 3.3 `reports/types.ts` `receiptBySourceSchema` gains optional
        `promoter`; update the fixtures in `receipt.test.ts`,
        `digest-pipeline-rehearsal.test.ts`, `digest-repository.test.ts`;
        narrow the `resolveFoundVia` property assertion to the four prior
        sources (Property 3)
    - _Requirements: 2.9, 5.11, 10.7_

- [ ] 4. Promoter module (R2, R5, R6.5, R8.3)
  - [ ] 4.1 `backend/src/features/promoter/{types,repository,service,handler}.ts`
        with rows per the design table; Audit row on every mutation; split
        the service by concern before 300 lines
    - _Requirements: 8.3_
  - [ ] 4.2 `POST /v1/promoter/me` (writes Promoter and Adult tick rows),
        `GET /v1/promoter/me`
    - _Requirements: 2.1, 2.8_
  - [ ] 4.3 `isMapEligibleBusiness` in `nodes/repository.ts`; refactor
        `getNodesByCitySlug` to call it
    - _Requirements: 4.1.9; locked decision 1_
  - [ ] 4.4 Node fields `acceptingPromoters`, `promotersPerNight`;
        `PATCH /v1/business/nodes/:nodeId/promoter-settings`
    - _Requirements: 3.1a; locked decisions 19, 22_
  - [ ] 4.5 Applications: apply (note max 200), list, accept (three fields
        required; Affiliation with `code`; Link by hash), drop (future
        claims deleted, current night kept)
    - _Requirements: 2.2, 3.1a, 3.3, 6.2, 7.1; locked decisions 14, 20_
  - [ ] 4.6 Claims: create, delete before close, horizon, rooms per night,
        rooms held, category rule, node per-night count, snapshots, Week
        marker `WEEKCLAIM#`
    - _Requirements: 5.12; locked decisions 10, 18, 21, 22a_
  - [ ] 4.7 Track record read `GET /v1/promoter/venues/:nodeId/track-record`
    - _Requirements: 2.3_
  - [ ] 4.8 Suggestions: create, dismiss; `TonightForm` accepts a prefilled
        headline
    - _Requirements: 2.6, 5.10_
  - [ ] 4.9 Unit tests for every rule, including the 16:00 close across
        the 04:00 rollover and the `weekStart` derivation from `night`

- [ ] 5. Link, open and arrival (R3)
  - [ ] 5.1 `venueOpenBodySchema` gains `promoterCode?`; service resolves
        the code, stores `promoterLinkId`, falls back to `share`; response
        `{ sharedBy }`; raw code not stored or logged by the service
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.1_
  - [ ] 5.2 Share route accepts `p`; OG description prefix; redirect with
        `src=promoter&p=`
    - _Requirements: 3.1, 6.6_
  - [ ] 5.3 `parseVenueArrival` reads `p`; stash carries it; arrival effect
        passes it; "Shared by {name}" on the venue card from the response
    - _Requirements: 2.4, 3.6, 3.7_
  - [ ] 5.4 Business check-in row badge from `OPEN_SOURCE_PHRASE.promoter`,
        never a name
    - _Requirements: 2.7_
  - [ ] 5.5 Playwright: open `/node/{slug}?p=` logged out, sign in, land on
        the card with "Shared by"

### Phase 3: the payable decision

- [ ] 6. `resolvePayable` (R4.1, R4.2)
  - [ ] 6.1 Pure function, `PayableFacts`, reasons enum in `found-via.ts`
  - [ ] 6.2 Property 2

- [ ] 7. Facts and transaction (R4.3 to R4.5, R5.3, R8.1, R8.2)
  - [ ] 7.1 `countCheckInsAtNodeSince` in `check-in/dynamodb-repository.ts`
        (key condition on `timestamp`, COUNT, paginated); test against a
        multi-page history
    - _Requirements: 4.1.7_
  - [ ] 7.2 `check-in/payable-facts.ts`: proximity read for QR check-ins
        with position (coordinates discarded), adult tick, map
        eligibility, link, claim, pause via the dynamic-import seam
    - _Requirements: 4.1.4, 4.1.8, 4.1.9, 4.1.12, 4.1.13, 5.3a, 6.3_
  - [ ] 7.3 `check-in/payable-repository.ts`: transaction (night count,
        week cents, Payable row with `rateCents`, `feeCents`, GSI1 `PAY#`),
        cap mark once, duplicate silent, errors logged and check-in
        unaffected
    - _Requirements: 4.3, 4.4, 4.5, 8.1, 8.2; locked decision 22a_
  - [ ] 7.4 One call line in `processCheckIn`; `lines-ratchet.mjs` green
    - _Requirements: 5.3_
  - [ ] 7.5 Property 4 (one place left; cents ceiling with two rates)
  - [ ] 7.6 Unit test: `foundVia`, `payable`, promoter id in the body are
        ignored
    - _Requirements: 6.1_
  - [ ] 7.7 Property 7: no `lat`/`lng` in log calls in the two modules
    - _Requirements: 6.3, 9.3_

- [ ] 8. Client facts (R4.1.4, R4.1.8, R9.4)
  - [ ] 8.1 `QrCheckIn.tsx`: `requestLocation()`; post a position only for a
        fresh fix (`acquired` or `poorAccuracy`); timeout, denial, and a
        stored `lastKnownPosition` post the token alone. Do not export
        `GPS_TIMEOUT`
  - [ ] 8.2 18+ checkbox on the nightlife venue card beside "Shared by" and
        in Settings; `PATCH /v1/users/me/adult-self-tick`; never blocks
  - [ ] 8.3 `AREA_CODE_FLAG_NIGHTLIFE_TICK`: prod Terraform `true`, dev
        Terraform `false`; missing in prod refuses to start; listed in
        `rules/tech.md` backend env
    - _Requirements: 9.5, 11.3_

### Phase 4: statements and the fee

- [ ] 9. Dispatch and lock (R5.12, R7.2, R7.3, R8.4, R8.5)
  - [ ] 9.1 `dispatcher.ts`: query `WEEKCLAIM#{weekStart}`, enqueue
        `statements` messages; first pass of a month enqueues
        `arrival_fee_invoice`
  - [ ] 9.2 `reports/statements.ts` `lockStatements` per design; one call
        line in `generator.ts`
  - [ ] 9.3 Property 5
  - [ ] 9.4 `statement_ready` notification; one digest email line
  - [ ] 9.5 Marks: promoter route keyed by node and week, venue route;
        conditional on the caller; marks never change figures or pause
    - _Requirements: 7.4, 2.3_

- [ ] 10. Invoice, checkout, pause (R7.5 to R7.9, R9.7)
  - [ ] 10.1 `business/arrival-fee.ts`: `readArrivalFeeCents()`
        (`number | null`), `createArrivalFeeInvoice`, `isAccrualPaused`
        (Query desc limit 1), `markInvoicePaid`; Terraform sets
        `AREA_CODE_ARRIVAL_FEE_CENTS` to `1000` in both environments;
        `rules/tech.md`
  - [ ] 10.2 `POST /v1/business/me/arrival-fee/checkout`; webhook branch
        `type === 'arrival_fee'`; subscription branch explicit; unknown
        type logged and acknowledged
    - _Requirements: 5.7_
  - [ ] 10.3 `PlansPanel` "Arrival fee due" card; refresh on return

### Phase 5: surfaces, privacy, rehearsal

- [ ] 11. Consumer `/promoter` (R1.1, R2.5, R2.8, R4.5)
  - [ ] 11.1 Route; entries from Profile and Settings
  - [ ] 11.2 Rooms, Nights, Suggestions, Statements; copy link and post
        text; cap mark with time; paused state; track record before claim
  - [ ] 11.3 jsdom tests per section; 44 px; flex only; every mutation
        disabled in flight

- [ ] 12. Business `PromotersPanel` (R2.2, R7.1, R7.2)
  - [ ] 12.1 `PANELS`, `PANEL_LABELS`, `PANEL_PERMISSIONS`,
        `DashboardPanel` union; sections per design; "maximum owed this
        week"
  - [ ] 12.2 Component tests

- [ ] 13. Admin `PromotersScreen` (R8.6; locked decision 28)
  - [ ] 13.1 Disable, clustering report via `PAY#` and `PROMOTERS`,
        statement by key
  - [ ] 13.2 Tests

- [ ] 14. Privacy and erasure (R2.10, R9)
  - [ ] 14.1 Privacy Policy section in `legal-content.ts`
  - [ ] 14.2 `cleanup.ts`: add `PROMOTER#{userId}` to
        `referencingGsi1Partitions`; delete Link rows by each affiliation's
        `linkId`; Statements and Payable rows untouched; test
  - [ ] 14.3 Consent bump recorded as a release step in `docs/DEPLOY.md`

- [ ] 15. Copy (R5.6; locked decision 16)
  - [ ] 15.1 Locale JSON for web, business, admin
  - [ ] 15.2 Honest-copy property test extended (Property 6); "spend"
        absent

- [ ] 16. Rehearsal and gates
  - [ ] 16.1 Dev seed: one venue, one promoter, one week of Payable rows;
        run the Monday pass locally; one statement, one invoice when the
        fee is set, none when unset
  - [ ] 16.2 Playwright end to end per design
  - [ ] 16.3 `pnpm typecheck && pnpm test && pnpm lint && pnpm format:check && pnpm guard:serverless`,
        `check-table-closure.mjs`, `lines-ratchet.mjs`; results recorded
        in the decision doc
