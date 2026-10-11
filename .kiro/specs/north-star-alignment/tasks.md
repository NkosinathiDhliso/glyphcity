# Implementation Plan: North Star Alignment

## Overview

Eight steps. Steps 1 and 2 are copy and tests with no behaviour change.
Steps 3 to 5 tighten one feature each. Step 6 removes the boost sale and
campaigns. Step 7 is the second boost release. Step 8 verifies. No step
waits on the `vibe-order-toggle` spec. Property tests use fast-check, 100
runs, block-statement predicates, tagged
`Feature: North star alignment, Property N: <desc>`.

## Tasks

- [ ] 1. North-star test and landing copy (R1, R9)
  - [ ] 1.1 `packages/shared/lib/__tests__/north-star.test.ts` reads
        `rules/product.md` and asserts the heading and both sentences
    - _Requirements: 9.1_
  - [ ] 1.2 Add the `landing.*` keys `AuthLanding.tsx` reads to `en.json`;
        remove orphaned `auth.landing.*` keys after a grep; subtitle one
        sentence; third line "A reward from the room" / "Earned when you
        arrive."; About block as two keys naming leaderboards once, last
    - _Requirements: 1.1, 1.2, 1.3, 1.5_
  - [ ] 1.3 Playwright `consumer/landing-copy.spec.ts`: banned words and
        `|` absent from h1, value lines, About
    - _Requirements: 1.4, 9.2_

- [ ] 2. Rewards, reports and music guards (R5, R6, R7)
  - [ ] 2.1 `nearMeQuerySchema.strict()`; route test 400 on `sort`;
        Property 4 value invariance
    - _Requirements: 5.2_
  - [ ] 2.2 Move `sendReportReadyEmail` strings to an importable copy
        object; extend the honest-copy property test (Property 6)
    - _Requirements: 7.3_
  - [ ] 2.3 Grep test over `biz.plans.`, `biz.onboarding.`, `biz.landing.`
        and the trial and renewal builders: no "intelligence" or "insight"
    - _Requirements: 7.2_
  - [ ] 2.4 Property 5: `clearUserMusicData` attribute names; type-level
        assertions on `computeReceipt` input and `markerBeam` input
    - _Requirements: 6.3_

- [ ] 3. Leaderboard (R2)
  - [ ] 3.1 Export `AbuseCheckResult`; capture the result in
        `processCheckIn`; gate the increment on `flags.length === 0`;
        update the two mocks to return `{ flags: [] }`
    - _Requirements: 2.3_
  - [ ] 3.2 `incrementLeaderboard(cityId, userId, nodeId)` ADDs to a
        `venues` set; update `leaderboard-key-drift.test.ts`
    - _Requirements: 2.2_
  - [ ] 3.3 Read sorts by venue count, check-ins, user id; response gains
        `venueCount`; reset worker archives and clears both; pre-reset
        toast says rooms
    - _Requirements: 2.2, 2.5_
  - [ ] 3.4 Property 1
    - _Requirements: 2.2, 2.3_
  - [ ] 3.5 `LeaderboardRow` rooms first; zero-week "you" state with a Map
        button and no share button; delete `TierProgressNudge.tsx` and its
        import; empty board "No ranks yet. Open the map."; component tests
    - _Requirements: 2.4_

- [ ] 4. Feed (R4)
  - [ ] 4.1 Delete `social/milestones.ts`, its test, the `recordMilestone`
        call in `processCheckIn`, the merge in `getActivityFeed`,
        `MilestoneFeedItem`; drop the `milestones.js` mocks from the four
        named tests
    - _Requirements: 4.3_
  - [ ] 4.2 Client: `FeedType` drops `'milestone'`; remove
        `toMilestoneItem`, the `FeedItemRow` branch, the `shareCard.ts`
        milestone renderer and its test case, the `touchTargets` case,
        the `feedEnrichment.test.ts` arbitrary member
    - _Requirements: 4.3_
  - [ ] 4.3 `FeedItemRow`: one tap per item to `onFocusVenue`; component
        test asserts it for every rendered item; empty state "Nothing from
        friends yet. Open the map." with a Map button
    - _Requirements: 4.2, 4.3a_
  - [ ] 4.4 Property 3: every feed item has a node id
    - _Requirements: 4.2_

- [ ] 5. Tonight at a place you know (R3)
  - [ ] 5.1 Remove `streakAtRisk` and `streak_at_risk` from every home
        listed in R3.1, including the `notifications/service.ts` map and
        the four fixture files; delete `workers/streak-reminder.ts`
    - _Requirements: 3.1_
  - [ ] 5.2 Add `tonightAtKnownVenue` preference and
        `tonight_at_known_venue` type; Settings label "Tonight at a place
        you know"
    - _Requirements: 3.2, 3.4_
  - [ ] 5.3 `workers/tonight-known-venue-reminder.ts` per design; pure
        `pickTonightVenue`; 200 check-ins, 10 venues, both range bounds
        passed to `getCheckInsByUser`
    - _Requirements: 3.2, 3.3_
  - [ ] 5.4 Property 2 on the picker
    - _Requirements: 3.2, 3.3_
  - [ ] 5.5 Terraform: rename the Lambda module and schedule entry in both
        environments, same cron; env gains `NODES_TABLE`,
        `MUSIC_SCHEDULES_TABLE`, `REWARDS_TABLE`; rename and extend the
        `BROAD_IAM_ALLOWLIST` entry; update `docs/RUNBOOK.md` and the
        go-live check log-group name
    - _Requirements: 3.2, 3.4a_

- [ ] 6. Removals, release A (R8.2 release A, R8.3)
  - [ ] 6.1 Boost sale: delete every item in the R8.2 release A list;
        keep every item in the release A keep list; Plans copy loses boost
        lines; grep for each deleted symbol returns nothing
    - _Requirements: 8.2_
  - [ ] 6.2 Campaigns: delete every item in the R8.3 removed list; keep the
        kept list; `campaigns/handler.ts` down to list, get, unsubscribe;
        grep for each deleted symbol returns nothing
    - _Requirements: 8.3_
  - [ ] 6.3 Terraform both environments: remove dispatcher and sender
        modules, `campaign-send` queue and DLQ, the API invoke statement,
        the two env vars; `terraform plan` shows only those removals
    - _Requirements: 8.3_
  - [ ] 6.4 `rules/tech.md`, `shared/config/env.ts`,
        `check-table-closure.mjs`, `go-live-check.ps1`,
        `check-brand-strings.mjs` updated; `pnpm sync:rules`
    - _Requirements: 8.3_
  - [ ] 6.5 Owner copy where the controls were: "Be on the map. Pay for
        arrivals." under the honest-copy test
    - _Requirements: 8.5_

- [ ] 7. Boost release B (R8.2 release B), at least 7 days after 6 is live
  - [ ] 7.1 Delete the webhook boost branch; unknown `metadata.type` logged
        at error level and acknowledged; delete `boostUntil` writes,
        `setNodeBoostWindow`, `isBoostActive`, `boostActive` in payloads,
        `RankInput` and fixtures, `vibeRank` level 3a, the two boost tests
    - _Requirements: 8.2_
  - [ ] 7.2 Update `discovery-dna-vibe-over-convenience.md` and
        `map-carousel.md` level 3 to tier only; `pnpm sync:rules`;
        existing ranking property tests pass
    - _Requirements: 8.2_

- [ ] 8. Verification
  - [ ] 8.1 `pnpm typecheck && pnpm test && pnpm lint && pnpm format:check && pnpm guard:serverless`
  - [ ] 8.2 `check-table-closure.mjs`, `scripts/lines-ratchet.mjs`
  - [ ] 8.3 Playwright consumer and business suites
