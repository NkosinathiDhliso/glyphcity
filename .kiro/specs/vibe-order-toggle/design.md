# Design Document

## Overview

One parameter on two existing rankers, one stored preference with two
homes and one owner, one control. Nothing new is computed; the first two
comparisons swap places.

### Binding constraints

- Single selection source of truth and camera contract from
  `map-carousel.md`: the toggle never flies the camera, never flips scope,
  never changes the Active_Venue.
- Proximity stays structurally incapable of outranking the top two levels
  in both modes (`discovery-dna-vibe-over-convenience.md`).
- No explainer copy (`glyph-language.md`).
- Failures are surfaced (`no-fallbacks-no-legacy.md`).

## Ranker

`packages/shared/constants/ranking.ts` (new, pure data):

```ts
export const ORDER_MODES = ['busy', 'crowd'] as const
export type OrderMode = (typeof ORDER_MODES)[number]
export const DEFAULT_ORDER_MODE: OrderMode = 'busy'
```

`carouselRanking.ts`, one comparator:

```ts
export interface RankInput { ...; orderMode?: OrderMode }
const mode = input.orderMode ?? DEFAULT_ORDER_MODE
// inside the comparator, deltas computed exactly as today
const tasteDelta = ...
const aliveDelta = ...
const [first, second] = mode === 'busy' ? [aliveDelta, tasteDelta] : [tasteDelta, aliveDelta]
if (first !== 0) return first
if (second !== 0) return second
// levels 3..6 unchanged
```

The doc comment on `vibeRank` lists both orders.

`rewards/ranking.ts`: `rankGetsByVibe(gets, orderMode = DEFAULT_ORDER_MODE)`
with the same shape. `rewards/repository.ts` already reads
`getUserById(viewerId)` for `archetypeId`; it takes `orderMode` from the
same object. `rewards/service.ts` passes the mode it receives from the
same read. `nearMeQuerySchema` is unchanged.

## Preference

- `auth/types.ts` user type gains `orderMode?: OrderMode`.
- `profile-handler.ts` PATCH schema gains `orderMode: z.enum(ORDER_MODES).optional()`.
- `GET /v1/users/me` returns it.
- `useUserStore` gains top-level `orderMode: OrderMode` (persisted, default
  `busy`) and `setOrderMode(mode)`. `setUser(user)` reconciles: if
  `user.orderMode` is set, copy it to the top-level field; else PATCH the
  local value once. `clearUser` leaves `orderMode` alone.
- `setOrderMode` writes the store first, then, when `user` is present,
  `api.patch('/v1/users/me', { orderMode })`. On failure it keeps the
  local value and calls the existing toast store with
  `t('map.order.saveFailed', "Couldn't save your order choice")`.
- `rankVenuesFromStores` passes `useUserStore.getState().orderMode`.

## Control

`apps/web/src/components/OrderModeControl.tsx` (one component, under 100
lines): a `role="group"` with `aria-label` "Order venues by" and two
`<button>`s, `aria-pressed` on the active one, `min-h-11`, `rounded-xl`,
`bg-[var(--bg-raised)]`, active option `bg-[var(--accent)] text-[var(--on-accent)]`,
`active:scale-95`. Labels from i18n keys `map.order.busiest` and
`map.order.crowd`.

Placement in `PeekCarousel.tsx`: the Browse_Mode top row that today renders
`recommendedCue` alone becomes a flex row, control on the left, back cue
on the right when `browseScope === 'area'`. The back cue gains `min-h-11`
and `flex items-center`. The row renders only in the non-empty branch; the
`carouselOrderVMs.length === 0` branch keeps the back cue alone. Hidden in
Constellation peek and Commit_Mode, which do not render this strip.

Selection handler: `setOrderMode(mode)` then
`useCarouselSelection().recomputeOrder()`. `notifyViewportChanged` is not
called, so scope cannot flip; no camera call is made.

## Rules

`discovery-dna-vibe-over-convenience.md` "Known code" lists the two orders;
the hard rule "never make proximity the primary sort key" is restated as
"proximity sits below both top levels in both modes". `map-carousel.md`
first bullet reads "Two scopes, two orders, one ranker".
`constellation-mode.md` cap paragraph: "which beams survive the cap follows
the active order; brightness is pulse only". All link decision 1.
`pnpm sync:rules` regenerates the mirrors.

## Tests

Property tests, 100 runs, block bodies, tagged
`Feature: Vibe order toggle, Property N`:

1. Mode semantics and lower-level equality.
2. Distance never decides across a top-two difference, both modes.
3. Front and back rankers agree on pairwise order given the same signals,
   `boostActive: false` pinned.

Existing `carouselRanking.test.ts`, `goingIsolation.property.test.ts`,
`pointModeRanking.property.test.ts`, `usePresenceSeeding.test.ts` are
parameterised over both modes; `crowd` must reproduce today's expectations
unchanged.

Component test (jsdom): visibility rules including the empty state; one
PATCH when signed in, none when logged out; failed PATCH shows the toast;
Active_Venue unchanged across a toggle. Playwright: toggle on the strip,
order changes, `map.getCenter()` and zoom unchanged, choice survives a
reload while logged out.
