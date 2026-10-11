# Requirements Document

## Introduction

`docs/decisions/north-star-alignment.md` decision 1: the guest chooses
whether busy rooms or their crowd lead the browse order. Today `vibeRank`
(`apps/web/src/lib/carouselRanking.ts`) is fixed: taste, aliveness, paid
lever, live gets, distance, id. The backend `rankGetsByVibe`
(`backend/src/features/rewards/ranking.ts`) mirrors it for the reward
layer. This spec adds one two-mode control and threads the mode through
both rankers without changing anything below the top two levels.

The map stays honest in both modes: every room still shows, with its honest
state, at its honest brightness. Only the order changes.

Sibling: `north-star-alignment` (decides this; removes `boostActive` from
level 3 in its release B). This spec does not depend on that release; it
treats level 3 as whatever it is when it lands.

## Glossary

- **Order_Mode**: `busy` or `crowd`. `busy` is aliveness first, taste
  second. `crowd` is taste first, aliveness second (today's order). Default
  `busy`.
- **Order_Control**: the one two-option control on the Browse_Mode strip.
- **Order_Preference**: the stored Order_Mode. Held locally in the persisted
  `useUserStore` for every visitor, and on the user record for a signed-in
  guest. Unset reads as `busy`.

## Out of scope

- A third mode, a slider, weights, or per-category modes.
- Any change to levels 3 to 6 of `vibeRank`, to beam brightness, to map
  membership, or to the Receipt.
- Hiding rooms in either mode.

## Locked decisions

1. Two modes only. `busy` default. Labels in copy: "Busiest" and "My
   crowd". "Busy" alone is a live-state label
   (`packages/shared/constants/state-labels.ts`) and is not reused for the
   control.
2. The mode is a parameter of `vibeRank` and `rankGetsByVibe`, not a second
   function. One comparator in each: compute the taste and aliveness
   deltas once, apply them in mode order, then fall through to levels 3 to
   6 unchanged.
3. The preference has two homes with one owner. `useUserStore` holds
   `orderMode` as a top-level persisted field so a logged-out visitor's
   choice survives reloads; the user record holds it so web and mobile
   agree once signed in. On login the server value wins if set; otherwise
   the local value is PATCHed up once. Unset anywhere reads `busy`.
4. The control sits on the Browse_Mode strip, above the cards, in the row
   where "Back to recommended" renders. It is hidden in Constellation peek,
   in Commit_Mode, and in the empty Browse_Mode state ("No venues in view").
5. Changing the mode calls the hook's existing `recomputeOrder` and keeps
   the Active_Venue selected. It does not move the camera and does not
   change browse scope (`map-carousel.md`).
6. The Constellation top-20 beam cap selects by `vibeRank`, so which quiet
   venues survive the cap at `zoom < 6` follows the active mode. Beam
   brightness never does; it is pulse only (`constellation-mode.md`).
7. Property: in both modes, for every input, distance never decides between
   two venues that differ on either of the top two levels.

## Requirements

### Requirement 1: One ranker, one parameter

1. `vibeRank(input)` SHALL accept `orderMode: OrderMode` in `RankInput`,
   defaulting to `DEFAULT_ORDER_MODE` when absent. `busy` compares
   aliveness before taste; `crowd` compares taste before aliveness. Levels
   3 to 6 SHALL be unchanged in both.
2. `rankGetsByVibe(gets, orderMode)` SHALL apply the same two orders. Both
   callers (`rewards/repository.ts`, `rewards/service.ts`) SHALL pass the
   viewer's stored mode, read from the same `getUserById` the near-me path
   already performs for `archetypeId`. `nearMeQuerySchema` SHALL NOT gain a
   mode parameter.
3. `rankVenuesFromStores` SHALL read `useUserStore.getState().orderMode`
   and pass it. No caller SHALL construct a second ranking path.
4. Existing ranking property tests SHALL run in both modes. The `crowd`
   mode outputs SHALL equal today's outputs for every arbitrary.

### Requirement 2: The control

1. THE Order_Control SHALL be a segmented two-option control, labels
   "Busiest" and "My crowd", each option at least 44 px tall,
   `active:scale-95`, colours from CSS variables only, `rounded-xl`.
2. IT SHALL render only in Browse_Mode at or above `MIN_MARKER_ZOOM` with
   at least one card, in the top row of the strip. In `area` scope it
   SHALL share the row with "Back to recommended", which SHALL gain
   `min-h-11` so both controls in the row meet the touch target rule.
3. SELECTING a mode SHALL update the store at once, call `recomputeOrder`,
   keep the Active_Venue, and, when signed in, persist with one PATCH. A
   failed PATCH SHALL keep the local choice and show the existing toast
   with "Couldn't save your order choice"; the next change retries. The
   failure is surfaced, not swallowed.
4. THE control SHALL carry an accessible name "Order venues by" and
   `aria-pressed` on the active option.
5. NO tooltip, explainer or onboarding SHALL describe what the modes mean
   beyond the two labels (`glyph-language.md` posture: name, never explain).

### Requirement 3: Preference storage

1. THE user record SHALL gain `orderMode?: 'busy' | 'crowd'`. The profile
   PATCH schema SHALL accept it. Any other value SHALL be a 400.
2. `GET /v1/users/me` SHALL return it. `useUserStore` SHALL hold
   `orderMode` top-level (persisted) and SHALL reconcile on `setUser`:
   server value present wins; otherwise PATCH the local value once.
   `clearUser` SHALL keep `orderMode`.
3. Erasure needs no change: the field lives on the users row, which
   `cleanup.ts` already deletes last.

### Requirement 4: Rules and docs

1. `rules/discovery-dna-vibe-over-convenience.md` and `rules/map-carousel.md`
   SHALL be updated in the same change to describe the two modes and the
   invariant that proximity sits below both top levels in both modes.
   `rules/constellation-mode.md` cap paragraph SHALL note that cap
   membership follows the mode and brightness does not. `pnpm sync:rules`
   SHALL be run.
2. `docs/decisions/north-star-alignment.md` decision 1 SHALL be linked from
   the rule text.

### Requirement 5: Tests

1. Property 1: `busy` mode, aliveness dominates taste; `crowd` mode, taste
   dominates aliveness; levels 3 to 6 identical in both.
2. Property 2: distance never decides across a top-two difference, both
   modes.
3. Property 3: `rankGetsByVibe` and `vibeRank` agree on relative order for
   any pair given the same signals with `boostActive: false` pinned (the
   backend signal set has no boost field), both modes.
4. Component test: control renders only in Browse_Mode above the marker
   zoom with cards present; selection keeps the Active_Venue; one PATCH
   when signed in, none when logged out; failed PATCH shows the toast.
5. Playwright: toggle on the strip, order changes, camera does not move,
   choice survives a reload while logged out.

## Ship order

1. Ranker parameter, property tests, backend mirror.
2. Preference field, store, reconcile.
3. Control and component tests.
4. Rules update and sync.
