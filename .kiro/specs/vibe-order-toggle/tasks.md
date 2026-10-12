# Implementation Plan: Vibe Order Toggle

Property tests use fast-check, 100 runs, block-statement predicates, tagged
`Feature: Vibe order toggle, Property N: <desc>`.

## Tasks

- [x] 1. Ranker parameter (R1)
  - [x] 1.1 `packages/shared/constants/ranking.ts`: `ORDER_MODES`,
        `OrderMode`, `DEFAULT_ORDER_MODE`
    - _Requirements: 1.1_
  - [x] 1.2 `vibeRank`: `orderMode` in `RankInput`; one comparator applies
        the two deltas in mode order; levels 3 to 6 untouched; doc comment
    - _Requirements: 1.1_
  - [x] 1.3 `rankGetsByVibe(gets, orderMode)`; `rewards/repository.ts` and
        `rewards/service.ts` pass the viewer's stored mode from the
        existing `getUserById` read; `nearMeQuerySchema` unchanged
    - _Requirements: 1.2_
  - [x] 1.4 `rankVenuesFromStores` passes `useUserStore.getState().orderMode`
    - _Requirements: 1.3_
  - [x] 1.5 Properties 1, 2, 3 (`boostActive: false` pinned in 3);
        parameterise the four existing ranking test files over both
        modes, `crowd` reproducing today's expectations
    - _Requirements: 1.4, 5.1, 5.2, 5.3_

- [x] 2. Preference (R3)
  - [x] 2.1 User type, PATCH schema, GET response carry `orderMode`
    - _Requirements: 3.1, 3.2_
  - [x] 2.2 `useUserStore`: top-level persisted `orderMode`,
        `setOrderMode`, reconcile in `setUser`, `clearUser` keeps it;
        failed PATCH keeps local and shows the toast
    - _Requirements: 2.3, 3.2_
  - [x] 2.3 Unit tests: 400 on an unknown value; unset reads `busy`;
        reconcile both directions; logged-out change issues no PATCH
    - _Requirements: 3.1, 3.2_

- [x] 3. Control (R2)
  - [x] 3.1 `OrderModeControl.tsx` per design; i18n keys
        `map.order.busiest`, `map.order.crowd`, `map.order.saveFailed`
    - _Requirements: 2.1, 2.4, 2.5_
  - [x] 3.2 Place in the Browse_Mode top row of `PeekCarousel.tsx`
        (non-empty branch only); back cue gains `min-h-11`; selection
        calls `recomputeOrder` with no camera move or scope change;
        Active_Venue preserved
    - _Requirements: 2.2, 2.3_
  - [x] 3.3 Component test (jsdom) and Playwright per design
    - _Requirements: 5.4, 5.5_

- [x] 4. Rules (R4)
  - [x] 4.1 Update `discovery-dna-vibe-over-convenience.md`,
        `map-carousel.md`, `constellation-mode.md`; link decision 1;
        `pnpm sync:rules`
    - _Requirements: 4.1, 4.2_

- [x] 5. Verification
  - [x] 5.1 `pnpm typecheck && pnpm test && pnpm lint && pnpm format:check`
  - [x] 5.2 `cone-invariants.test.ts` and `no-global-events-feed.test.ts`
        unchanged and green

## Deviations recorded

- 1.3: the `rewards/service.ts` DEV_MODE path reads no user, so it ranks on
  `DEFAULT_ORDER_MODE`. The live path reads the viewer's mode in
  `rewards/repository.ts` from the existing `getUserById` read.
- 2.2: `setUser` stays a plain write. The login reconcile lives in
  `apps/web/src/lib/orderModePreference.ts` (`reconcileOrderMode`), called on
  each fresh `GET /v1/users/me` (App start-up and Profile). It runs once per
  user per page lifetime: a stored choice wins, otherwise the local choice is
  PATCHed up. Running it from the store would PATCH from a stale persisted
  user before the server profile arrives, and would let a later refresh undo
  a failed save. The failed-save message uses the existing error toast
  (`useErrorStore.showError`); the Toast_System queue is for live-activity
  toasts.
- 3.3: the app does not expose the Mapbox instance to the page, so the
  Playwright spec checks the camera through what a camera move would change
  (Active_Venue, browse scope, carousel mode). The jsdom component test
  asserts no `flyTo`/`easeTo`/`jumpTo` call directly. Logged out, every taste
  score is 0, so both modes give the same order; order semantics are covered
  by Properties 1 to 3, not by Playwright.
- 4.1: `rules/product.md` (gets ranking line) was updated too, since it
  restates the `rankGetsByVibe` order.
- Not run here: Playwright (needs a running stack) and the PowerShell guards.
  `apps/web/src/components/PeekCarousel.tsx` was already past its frozen size
  in the lines ratchet and grows by the control row.
