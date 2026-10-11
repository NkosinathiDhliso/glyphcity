# Design Document

## Overview

### Goals

- Make the landing page, the leaderboard, the evening reminder, the feed,
  rewards and reports each pass one of the two north-star tests, with a test
  that keeps it that way.
- Remove the boost sale and the campaign send, with their infrastructure,
  keeping only what audit and a guest's existing choice need.
- Leave `vibeRank` untouched here; the order toggle is its own spec.

### Non-Goals

- Any new surface, tab, incentive or notification type beyond the one
  replacement reminder.
- Deleting purchase rows, campaign rows or `COPTOUT#` rows.
- Changing beams, glyphs, map membership or presence rules.

### Binding constraints

- Tightening removes; it never adds an incentive.
- Dead code is deleted, not stubbed. The phone-OTP 410 pattern is not
  reused: nothing external calls these routes.
- One home per concept. The north-star sentence lives in `rules/product.md`;
  a test reads it from there.
- No migration, no backfill, no new schedule. One schedule is renamed.
- Every removal lists its importers. A grep for the deleted symbol after the
  change returns nothing outside git history.

## Architecture

### Component map

```
apps/web
  AuthLanding.tsx + en.json       landing.* keys exist; third line; subtitle one sentence
  LeaderboardScreen.tsx           rooms then check-ins; zero-week "you" state; TierProgressNudge gone
  FeedScreen.tsx, FeedItemRow.tsx, feedEnrichment.ts, shareCard.ts   milestone gone; empty state to map
  NotificationSettings.tsx        tonightAtKnownVenue replaces streakAtRisk; Win-back toggle gone

packages/shared
  components/TierProgressNudge.tsx       deleted
  constants/notification-preferences.ts  key swap
  types/index.ts                         key swap; boost types (release B)
  stores/businessStore.ts                'boost' and 'campaigns' leave the union; campaignPrefill gone
  lib/featureGating.ts                   getIncludedBoosts deleted
  mocks/mockRouter.ts                    boost and campaign mocks deleted

backend
  check-in/service.ts             abuse result captured; increment gated; recordMilestone call gone
  check-in/abuse.ts               AbuseCheckResult exported
  check-in/dynamodb-repository.ts incrementLeaderboard(cityId, userId, nodeId) ADDs to a set
  social/repository.ts, service.ts  sort by set size; milestone merge gone; milestones.ts deleted
  workers/tonight-known-venue-reminder.ts   replaces streak-reminder.ts
  workers/leaderboard-reset.ts    archives and clears venues
  notifications/types.ts, service.ts   key swap
  rewards/types.ts                nearMeQuerySchema.strict()
  shared/email/ses.ts             sendReportReadyEmail copy under the honest-copy test
  business/, nodes/boost.ts       release A and B per R8.2
  campaigns/                      trimmed to repository, unsubscribe, list and get

infra (both environments)
  streak-reminder Lambda and schedule renamed, env gains three tables
  campaign dispatcher and sender Lambdas, campaign-send queue and DLQ, API invoke permission and env vars removed

scripts
  check-table-closure.mjs         allowlist entry renamed with the new table list
  go-live-check.ps1               DLQ probe and campaign-sender log group removed
  check-brand-strings.mjs         campaigns/sender.ts line removed
```

## R1: Landing copy

`AuthLanding.tsx` calls `t('landing.subtitle', ...)`, `t('landing.step3Title', ...)`
and so on; `en.json` holds `auth.landing.*`, so every fallback is the live
string. Add the `landing.*` keys the component reads, remove the orphaned
`auth.landing.*` keys if nothing else reads them (grep first), and set:

| Key                                  | Value                                                           |
| ------------------------------------ | --------------------------------------------------------------- |
| `landing.subtitle`                   | `See which bars, cafés and clubs are alive near you right now.` |
| `landing.step3Title`                 | `A reward from the room`                                        |
| `landing.step3Body`                  | `Earned when you arrive.`                                       |
| `landing.aboutP1`, `landing.aboutP2` | two paragraphs; leaderboards named once in P2, last             |

Playwright `tests/e2e/tests/consumer/landing-copy.spec.ts`: load `/`, read
the `<h1>`, the three value lines and the About block, assert none of
`climb`, `board`, `rank`, `perks`, `points`, `streak` appears
(case-insensitive, word boundary) and that no text node contains `|`.

## R2: Leaderboard

### Write

`abuse.ts` exports `AbuseCheckResult`. In `processCheckIn`:

```ts
const abuse = await runAbuseChecks(userId, input.nodeId, input.fingerprintHash, '')
...
if (cityId && abuse.flags.length === 0) {
  try { await incrementLeaderboard(cityId, userId, input.nodeId) } catch ...
}
```

The pulse refresh in the same `if (cityId)` block is not gated; only the
increment moves. `incrementLeaderboard` becomes:

```ts
UpdateExpression: 'ADD checkInCount :one, venues :node'
ExpressionAttributeValues: { ':one': 1, ':node': new Set([nodeId]) }
```

`leaderboard-key-drift.test.ts`, `checkin-always-contributes.property.test.ts`
and `found-via-stamp.test.ts` are updated for the third argument and the
`{ flags: [] }` mock return. This is one line in the frozen
`check-in/service.ts` changing shape, not growing; the ratchet stays green.

### Read

`social/repository.ts` sorts `(venues?.size ?? 0) desc, checkInCount desc, userId asc`
in the one helper both reads share. The response gains `venueCount`.
`leaderboard-reset.ts` archives and clears both attributes. `preResetHandler`
toast: "Ranks reset tonight. You're #{rank} with {venueCount} rooms this week."

### UI

`LeaderboardRow` shows rooms first, check-ins second, small. The "you"
row for a viewer with zero check-ins this week shows "Not on the board yet.
Open the map." and a Map button (44 px, `active:scale-95`); the share
button is hidden in that state. `TierProgressNudge` is deleted with its
import. Empty board copy: "No ranks yet. Open the map."

## R3: Tonight at a place you know

### Removal

Every home in R3.1, including `notifications/service.ts` line
`streak_at_risk: 'streakAtRisk'` in the type-to-preference map.

### Replacement

`workers/tonight-known-venue-reminder.ts`, same EventBridge slot (Terraform
module and schedule entry renamed, same cron):

1. Iterate users as the old worker did. Skip unless
   `prefs.tonightAtKnownVenue === true`.
2. Dedup key `notif:tonight_known:{userId}:{nightDate}` (26 h TTL).
3. `getCheckInsByUser(userId, { startTime: now - 90d, endTime: now, limit: 200 })`
   (the repository applies the range only when both bounds are given);
   distinct node ids, most recent first, first 10.
4. Load those nodes, group by `businessId`; for each business
   `loadTonightForBusiness(businessId, nowIso)` then `resolveTonightSlot`.
   First node in visit order with a Tonight today wins.
5. Skip if the user holds a Going row for that node and night (the
   Tonight_Reminder covers them).
6. `sendNotification({ type: 'tonight_at_known_venue', title: venue name, body: 'Expected tonight: {headline}' })`.

The pure picker `pickTonightVenue(visitedNodeIdsInOrder, tonightByNodeId, goingNodeIds)`
returns the node id or null and carries the property test.

Tables: `USERS_TABLE`, `CHECKINS_TABLE`, `APP_DATA_TABLE` as before, plus
`NODES_TABLE`, `MUSIC_SCHEDULES_TABLE`, `REWARDS_TABLE` (the Tonight
reader resolves the featured get). Terraform env block and the
`BROAD_IAM_ALLOWLIST` entry (`tonight_known_venue_reminder`) list all six.

Cost, stated plainly: an unfiltered users scan once per evening, as today.
At pilot scale that is a few hundred reads plus up to 10 node reads per
opted-in user. When the user count passes ten thousand, a follow-up adds a
GSI on the preference. That follow-up is named here so no one assumes it
exists.

## R4: Feed

Delete `social/milestones.ts`, `milestones.test.ts`, the `recordMilestone`
dynamic import in `processCheckIn`, the merge in `getActivityFeed` and
`MilestoneFeedItem`. Client: `FeedType` becomes
`'checkin' | 'live_get' | 'archetype_cluster'`; `toMilestoneItem` and the
`FeedItemRow` milestone branch go; `shareCard.ts` loses the milestone
renderer and `shareCard.test.ts` its case; `touchTargets.test.tsx` loses
the milestone share-button case; `feedEnrichment.test.ts` arbitrary drops
`'milestone'`; the `found-via-stamp`, `checkin-always-contributes`,
`two-device-rehearsal` and `proof-of-demand-rehearsal` tests drop their
`milestones.js` mocks. `FeedItemRow` keeps one tap per item calling
`onFocusVenue(node.id)`; the component test asserts it for every rendered
item. Empty state: "Nothing from friends yet. Open the map." with a Map
button. Page size unchanged.

## R5: Rewards

`nearMeQuerySchema = z.object({...}).strict()`. Route test:
`?lat=&lng=&sort=value` is 400. New
`rewards/__tests__/value-invariance.property.test.ts`: for any list of
gets and any mutation of `value`, `discount`, `title`, `description`,
`rankGetsByVibe` returns the same id order.

## R6: Music linking

Unit test pins the `UpdateExpression` attribute names of
`clearUserMusicData` to the taste fields. Type-level test (a `.test-d.ts`
or an `expectTypeOf` case) asserts `computeReceipt`'s input type and the
`markerBeam` brightness input have no `archetypeId` or music affinity key.

## R7: Reports

`sendReportReadyEmail` strings move to an importable copy object in the
same module pattern the digest uses; the honest-copy property test imports
it. Grep test: the locale key prefixes `biz.plans.`, `biz.onboarding.`,
`biz.landing.` and the trial and renewal builders in `ses.ts` contain
neither "intelligence" nor "insight".

## R8: Removals

### Boosts

Release A and B exactly as enumerated in R8.2. Two details:

- `handlePaymentSucceeded` in release A is unchanged. In release B the boost
  branch is deleted and the function becomes: `type === 'subscription'`
  runs the subscription branch; any other value logs
  `{ branch: 'unknown_payment_type', type }` at error level and returns, so
  Yoco receives 2xx and stops retrying. `promoter-arrivals` later adds
  `'arrival_fee'` as a second explicit branch.
- `apps/business/src/screens/panels/checkoutReturnState.ts` keeps the
  subscription branch only; its test file drops the boost cases.

### Campaigns

`campaigns/handler.ts` keeps three routes: list, get, unsubscribe.
`campaigns/types.ts` keeps the schemas those need. `app.ts` registration
is unchanged. `NotificationSettings.tsx` loses the `campaign-optout` query
and mutation and the "Win-back offers" row; its i18n key goes.
`ReportsPanel.tsx` loses `setCampaignPrefill` and the "Create win-back
campaign" control. Terraform: remove the two Lambda modules, the queue and
DLQ, the API Lambda's `lambda:InvokeFunction` statement for the dispatcher,
and the two env vars, in both environments; `terraform plan` shows only
those removals. `shared/config/env.ts` drops the two names.

## R9: The test that keeps it true

`packages/shared/lib/__tests__/north-star.test.ts` reads
`rules/product.md`, finds the `## North star` heading, and asserts the two
sentences "making the map more truthful about who is in the room" and
"letting a venue pay for arrivals it can verify" are present verbatim.

## UI contract

Mobile-first at 375 px, CSS variables only, `rounded-2xl` cards, 44 px
targets, `active:scale-95` on buttons, no CSS grid in shared components,
no emojis, no em dashes. Empty states say less rather than nudge.

## Testing summary

Property tests, 100 runs, block bodies, tagged
`Feature: North star alignment, Property N`:

1. Leaderboard sort: venue count dominates, check-ins break ties, user id
   last; a check-in with any flag never changes a row.
2. `pickTonightVenue`: null when no visited venue has a Tonight; never a
   venue in `goingNodeIds`; always the earliest in visit order otherwise.
3. Feed: every returned item has a node id.
4. `rankGetsByVibe` value invariance.
5. `clearUserMusicData` attribute names (unit) and the two type-level
   assertions.
6. Honest copy over the report-ready email.

Playwright: landing banned words and no `|`; leaderboard and feed empty
states have a Map button.

Verification: `pnpm typecheck && pnpm test && pnpm lint && pnpm format:check && pnpm guard:serverless`,
`check-table-closure.mjs`, `scripts/lines-ratchet.mjs`, `terraform plan`
shows only the named removals and the rename.
