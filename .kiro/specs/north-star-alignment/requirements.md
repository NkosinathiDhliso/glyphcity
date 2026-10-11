# Requirements Document

## Introduction

`rules/product.md` now names one north star: GlyphCity is the live map of
which rooms are actually busy. A feature earns its place by making the map more
truthful about who is in the room, or by letting a venue pay for arrivals it
can verify. Anything else is a gimmick.

An audit of the shipped app against that sentence found three groups:

- **Fights it.** Taste ranks above busy in `vibeRank`. Boosts sell position,
  not arrivals. Win-back campaigns sell reach, not arrivals. Streak reminders
  pull a check-in for a number, not for a room.
- **Allowed, on a leash.** Ranks and leaderboards, rewards and First-Get, Feed
  and friends, music linking, venue intelligence reports.
- **Clean.** Map, beams, check-in, check-out, presence expiry, pulse decay,
  Tonight, Going, the Receipt, the digest, membership, QR, staff validator,
  consent and privacy.

This spec, **North Star Alignment**, tightens the leash group and carries
out the three founder decisions on the fights group recorded in
`docs/decisions/north-star-alignment.md`: an order toggle (its own follow-up
spec), boosts retired, win-back campaigns retired. It changes no ranking
order, no pricing, and no map membership rule on its own. Sibling:
`promoter-arrivals`, whose Phase 2 waits on R8.2 release A.

## Glossary

- **North_Star**: the sentence in `rules/product.md` "North star". One home.
- **Truth_Test**: does the feature make the map more truthful about who is in
  the room? Pass or fail.
- **Arrival_Test**: does the feature let a venue pay for an arrival it can
  verify? Pass or fail.
- **Gimmick**: a feature that fails both tests.
- **Leash**: a feature that passes one test only under a stated limit. The
  limit is written here and enforced by a test.
- **Landing_Copy**: the three value lines on `AuthLanding` (Open the map,
  Check in, Earn rewards) and the page `<h1>`.

## Out of scope

- Changing the order of `vibeRank` levels here. Decision 1 is carried out
  by the `vibe-order-toggle` spec.
- Refunding any boost already bought. Boosts run to their end.
- Any change to beam geometry, cone invariants, or glyph names
  (`glyph-language.md`).
- Any change to map membership (`docs/decisions/map-membership.md`).
- Any new consumer tab, surface, or incentive.

## Locked decisions

1. Every requirement here must pass the Truth_Test or the Arrival_Test. The
   requirement text names which one.
2. Tightening means removing an incentive or a surface, never adding one.
3. Nothing in this spec runs a migration, a backfill, or a new scheduled
   job. The one existing evening schedule is renamed, not added.
4. Retired code is deleted, not stubbed and not guarded
   (`no-fallbacks-no-legacy.md`). Rows already written stay readable where
   an audit or a guest's choice depends on them; everything else goes. Each
   removal names every importer it deletes, so no orphan survives.
5. The three decisions live in `docs/decisions/north-star-alignment.md`,
   one file, one numbered section each, same shape as `proof-of-demand.md`.
   Kiro implements what is recorded and does not reopen them.

## Requirements

### Requirement 1: Landing copy leads with the room

Truth_Test. The first thing a guest reads must be the map, not a prize.

1. THE `<h1>` SHALL stay "Find the spots buzzing right now." or a founder-
   approved variant that names busy rooms.
2. THE third value line SHALL NOT read "Unlock perks. Climb the board." It
   SHALL describe the reward as something earned on arrival, for example
   "A reward from the room, when you arrive." The words "climb", "board",
   "rank", "perks", "points" and "streak" SHALL NOT appear in Landing_Copy.
3. THE About block SHALL mention leaderboards at most once, after check-in
   and after rewards, never as a reason to open the app.
4. A Playwright structural check SHALL assert the banned words are absent
   from Landing_Copy.
5. `AuthLanding.tsx` reads `landing.*` keys that are absent from `en.json`
   (the file holds `auth.landing.*`), so the inline fallbacks are the live
   copy, and the subtitle fallback carries a `|` where a dash was stripped.
   THE keys SHALL be added to `en.json` under the names the component
   reads, the fallbacks SHALL match them, and the subtitle SHALL read as one
   sentence with no separator character.

### Requirement 2: Leaderboards count rooms, not repetition

Truth_Test. A board that rewards volume pushes a guest to check in for the
number. A board that rewards distinct rooms rewards being somewhere real.

1. THE consumer Ranks tab SHALL continue to exist. No fifth tab, no removal.
2. THE ranking statistic SHALL be: distinct venues checked into this week,
   then total check-ins, then user id. Today it is total check-ins only
   (`checkInCount` on `LEADERBOARD#{cityId}` rows). The row SHALL gain a
   string set of node ids; the read SHALL sort by its size first.
3. A check-in that `runAbuseChecks` flags (`device_velocity`,
   `new_account_velocity`) SHALL NOT increment the leaderboard row. Today
   `processCheckIn` awaits `runAbuseChecks` and discards its result. THE
   result SHALL be captured, `AbuseCheckResult` SHALL be exported from
   `abuse.ts`, and the increment SHALL run only when `flags.length === 0`.
   No backfill, no read-time filter, no flag clearing. The flags stay
   advisory for the check-in itself. The two tests that mock
   `runAbuseChecks` as returning `undefined` SHALL return `{ flags: [] }`.
4. THE board SHALL NOT be shown to a guest with zero check-ins as a reason to
   check in. A viewer with zero check-ins this week SHALL see the board and
   an empty "you" state that points to the map, with no count-to-next-tier
   copy. `TierProgressNudge` (`packages/shared/components`, one importer,
   `LeaderboardScreen`) is a nudge for a number and SHALL be deleted.
5. THE weekly reset worker (`leaderboard-reset.ts`) SHALL archive and clear
   the new `venues` set alongside `checkInCount`, and nothing else about
   it SHALL change.

### Requirement 3: Streak reminder becomes a Tonight reminder

Truth_Test. A reminder to protect a streak asks for a check-in anywhere. A
reminder about a room asks for a visit to a place.

1. THE `streakAtRisk` preference, the `streak_at_risk` notification type
   and the "streak at risk" copy SHALL be removed from every home: the
   shared type and defaults (`packages/shared/types`,
   `constants/notification-preferences.ts`), the Zod schema
   (`notifications/types.ts`), the type-to-preference map
   (`notifications/service.ts`), `NotificationSettings.tsx`, the two
   `en.json` keys, `workers/streak-reminder.ts`, and the fixtures in
   `preferences-repository.test.ts`, `notification-pipeline.property.test.ts`,
   `data-integrity.test.ts` and `e2e.test.ts`. No alias, no carry-over:
   the preference was off by default and the app is pre-launch.
2. A new preference `tonightAtKnownVenue` (default off) and notification
   type `tonight_at_known_venue` SHALL replace them. The worker, renamed
   `tonight-known-venue-reminder`, SHALL run in the same evening slot with
   the same per-user-per-day dedup, and SHALL send one message naming one
   venue the guest has checked into in the last 90 days that has a Tonight
   today (`loadTonightForBusiness` in `nodes/tonight-reader.ts`, then
   `resolveTonightSlot`). It SHALL read at most 200 check-ins per user and
   consider at most 10 distinct venues, most recent first. No such venue
   means no message.
3. THE copy SHALL say what the venue announced ("Expected tonight at
   {venue}: {headline}") and SHALL NOT mention a streak, a count, or a
   reward. A guest who already holds a Going row for that venue and night
   SHALL be skipped, because the existing Tonight_Reminder covers them.
4. THE Settings label SHALL be "Tonight at a place you know". The pre-reset
   leaderboard toast is a different preference; its wording changes under
   R2 only.
   4a. THE renamed Lambda reads `NODES_TABLE`, `MUSIC_SCHEDULES_TABLE` and
   `REWARDS_TABLE` in addition to the old worker's three, so its Terraform
   env block and its `BROAD_IAM_ALLOWLIST` entry in
   `scripts/check-table-closure.mjs` SHALL list those tables.
5. Streak counting for rewards (`reward-evaluator.ts`, `streak` condition)
   SHALL be unchanged. The venue chose that reward; it is in-kind pay for an
   arrival.

### Requirement 4: Feed shows rooms, not scrolling

Truth_Test. Friends-at-venue is a fact about who is in a room. A feed to
scroll is not.

1. THE Feed tab SHALL continue to exist and SHALL keep the proximity-gated
   rewards read only (`GET /v1/rewards/near-me`), per `product.md`.
2. EVERY feed item SHALL be about a venue and SHALL carry a tap that focuses
   that venue on the map (`setFocusNodeId`). An item that cannot be tapped
   to the map SHALL NOT render.
3. Milestone items (`feedType: 'milestone'`) have no venue and are about the
   guest's own streak. THE writer (`recordMilestone` call in
   `processCheckIn`), the module `social/milestones.ts`, the merge in
   `getActivityFeed`, the client union member, the `FeedItemRow` milestone
   branch, the milestone share card in `shareCard.ts`, and their tests
   SHALL be deleted. The `MILESTONE#` line in the `cleanup.ts` erasure
   sweep SHALL stay until the dev and prod tables are confirmed to hold no
   such rows, then it goes. The `'milestone'` reward trigger type in
   `rewards/types.ts` is a different concept and is unchanged. The feed
   SHALL NOT render follower counts or any item whose subject is a person
   rather than a room.
   3a. THE feed empty state SHALL point to the map ("Nothing from friends yet.
   Open the map."), not to following more people.
4. THE feed SHALL cap at the existing page size and SHALL NOT add infinite
   autoplay, stories, or media that is not a venue photo.
5. Friends-at-venue SHALL remain aggregate and present-tense, subject to
   presence expiry. A friend who has checked out or expired SHALL leave the
   count in the same tick as the map.

### Requirement 5: Rewards stay the cherry

Arrival_Test. A reward handed over at the venue is an arrival the venue paid
for in kind.

1. NO reward SHALL be claimable without a check-in or a First-Get token
   issued at the venue.
2. NO consumer surface SHALL list rewards by discount size or value. The
   route-enumeration test (`no-global-events-feed.test.ts`) stays as the
   surface guard. A new property test SHALL assert that `rankGetsByVibe`
   (`rewards/ranking.ts`, called from `rewards/repository.ts` and
   `rewards/service.ts`) returns the same id order under any change to a
   get's value, discount, title or description fields. `nearMeQuerySchema`
   accepts unknown keys today; it SHALL become `.strict()` so a `sort`
   query is a 400, with a route test.
3. THE wallet in Profile SHALL stay utility only: code, venue, expiry. No
   browse, no filter.
4. First-Get SHALL remain token-based. No phone, no SMS
   (`no-sms-no-phone-auth.md`).

### Requirement 6: Music linking exists only for taste

Truth_Test, conditional. Music linking passes only while taste is part of
what "busy with your kind of crowd" means. It has no other job.

1. Spotify and Apple Music linking SHALL remain opt-in and SHALL feed the
   taste profile only. No playlist UI, no now-playing, no music surface.
2. Decision 1 keeps taste as the My crowd order, so music linking stays.
   IF a later decision removes taste from both orders, THEN the linking entry
   points SHALL be removed in the same release. No provider tokens are
   stored today; `clearUserMusicData` (`music/repository.ts`) nulls the
   taste fields on the user row and that is the whole deletion path.
3. A unit test SHALL pin the attribute names `clearUserMusicData` writes to
   the taste fields only, and a type-level test SHALL assert that
   `computeReceipt` and the beam-brightness input (`markerBeam.ts`) accept
   no taste field. That is the honest form of "unlinking changes nothing
   live".

### Requirement 7: Intelligence reports are a perk, not a pitch

Truth_Test. Reports are derived from honest presence. They are allowed as a
tier benefit. They are not the product.

1. REPORTS SHALL stay behind the existing tier gate and the Suppression_Floor.
2. THE following surfaces SHALL NOT contain "intelligence" or "insight":
   `apps/business` locale keys under `biz.plans.*`, `biz.onboarding.*` and
   `biz.landing.*`, and the trial and renewal email builders in
   `shared/email/ses.ts`. The Receipt leads there. `biz.reports.*` and
   `sendReportReadyEmail` may name the report. A grep test enforces exactly
   that list.
3. `sendReportReadyEmail` copy in `shared/email/ses.ts` SHALL be covered by
   the honest-copy property test, which today covers the digest, the
   Receipt and the business marketing keys only.

### Requirement 8: The fights group, decided

All three gates are recorded in `docs/decisions/north-star-alignment.md`
(2026-10-11). Kiro SHALL implement what is recorded and SHALL NOT reopen the
decision.

1. **Order toggle (decision 1).** `vibeRank` SHALL be unchanged by this spec.
   A follow-up spec, `vibe-order-toggle`, SHALL add a two-mode order control:
   Busy (aliveness, then taste; default) and My crowd (taste, then
   aliveness). Levels below the top two SHALL keep today's order. The toggle
   SHALL change order only, never membership, beams, or the Receipt. That
   spec SHALL update `discovery-dna-vibe-over-convenience.md` and
   `map-carousel.md` in the same change.
2. **Boosts retired (decision 2), two releases.** The only caller of
   `POST /v1/business/boost` is the business app, which changes in the same
   release, so the sale path is removed, not stubbed
   (`no-fallbacks-no-legacy.md`).
   - Release A removes: routes `POST /v1/business/boost`,
     `GET /v1/business/boosts/:boostId/scoreboard`, the three
     `/v1/admin/boost-floors*` routes; backend `purchaseBoost`,
     `floor-decision.ts`, `boost-scoreboard.ts`, `boost-scoreboard-read.ts`
     and their tests; business app `BoostPanel`, `ActiveBoostList`,
     `BoostScoreboardCard`, the `BoostPromptBanner` in `RewardsPanel`, the
     boost branch of `checkoutReturnState.ts` / `useCheckoutReturn.ts`, the
     `'boost'` key in `PANELS`, `PANEL_LABELS`, `PANEL_PERMISSIONS` and the
     `DashboardPanel` union, `operator-boost-render.property.test.tsx`;
     admin `BoostFloorEditor` and its nav entry; shared
     `getIncludedBoosts` (no callers), boost mocks in `mockRouter.ts`, the
     `boost` locale keys in business and admin `en.json`.
   - Release A keeps: `BoosterPurchase` rows, `persistBoosterPurchase`
     and the `metadata.type === 'boost'` webhook branch (a checkout paid
     before A may still deliver its event), the operator and admin
     boost-purchase read routes, `BoostPurchasesPanel`,
     `BoostPurchaseReport`, `isBoostActive` and `boostActive` in payloads.
   - Release B, at least 7 days after A is live (Yoco retries drain within
     that window and no 24-hour window can be in the future), removes:
     the webhook boost branch (an unknown `metadata.type` is then logged at
     error level and acknowledged), `boostUntil` writes,
     `setNodeBoostWindow`, `isBoostActive`, `boostActive` from node
     payloads, `RankInput` and the Point Mode fixtures, `vibeRank` level
     3a, the `boost-window` and `set-node-boost-window` tests, and the
     words "node boost" from `discovery-dna-vibe-over-convenience.md` and
     `map-carousel.md`. Purchase rows and their read routes stay.
3. **Win-back campaigns retired (decision 3), one release.** There is no
   scheduled state, so the `cancel` route is dead too. Removed: routes
   create, estimate, send and cancel under `/v1/business/me/campaigns`,
   `GET` and `POST /v1/users/me/campaign-optout` (a choice about mail that
   can no longer be sent), backend `quota.ts`, `dispatcher.ts`,
   `sender.ts`, `segment-resolver.ts`, `eligibility.ts`, `tier-gating.ts`,
   `anonymize.ts`, `workers/campaign-dispatcher.ts`,
   `workers/campaign-sender.ts` and their tests; business `CampaignsPanel`,
   its panel key in the three maps and the union, `campaignPrefill` and
   `setCampaignPrefill` in `businessStore`, the "Create win-back campaign"
   call in `ReportsPanel`; the "Win-back offers" toggle in
   `NotificationSettings.tsx`; the two Lambda modules, the `campaign-send`
   queue and DLQ, the API Lambda's async-invoke permission and its two env
   vars in both Terraform environments; the DLQ probe and the
   `campaign-sender` log-group entry in `scripts/go-live-check.ps1`; the
   `sender.ts` line in `scripts/check-brand-strings.mjs`. Kept: list and
   get routes and `campaigns/repository.ts` for the business's own audit,
   `GET /v1/campaigns/unsubscribe` and `unsubscribe.ts` so a link already
   in an inbox still works, `COPTOUT#` rows, campaign rows,
   `AREA_CODE_CAMPAIGN_UNSUB_SECRET`. `AREA_CODE_CAMPAIGN_SEND_QUEUE_URL`
   and `AREA_CODE_CAMPAIGN_DISPATCHER_FUNCTION` leave `rules/tech.md`,
   `shared/config/env.ts` and `check-table-closure.mjs`.
4. THE three changes SHALL ship independently. None SHALL wait on another.
5. Owner-facing copy where the controls were SHALL offer the replacement in
   measurement language: "Be on the map. Pay for arrivals." No causal verb.
6. `promoter-arrivals` carries no boost rule; its Phase 2 waits on release A.

### Requirement 9: The test that keeps this true

1. A unit test SHALL read the North_Star from `rules/product.md` and fail if
   the heading or the two tests are removed or reworded without this spec
   being updated.
2. THE Playwright suite SHALL carry the Landing_Copy banned-word check (R1.4).
3. THE leaderboard, feed, reward, and music property tests named above SHALL
   be tagged `Feature: north-star-alignment, Property N: <desc>`, minimum
   100 runs, block-bodied predicates.

## Ship order

1. R1 landing copy and R9 tests. No behaviour change, one afternoon.
2. R5 rewards guard and R7 report copy. Tests only, plus copy.
3. R2 leaderboard statistic and abuse binding.
4. R4 feed rules.
5. R3 streak reminder becomes Tonight reminder.
6. R8.2 release A and R8.3 campaign retirement, in either order.
7. R8.2 release B, at least 7 days after A.
8. `vibe-order-toggle` follow-up spec (R8.1). Not part of this spec's tasks.
