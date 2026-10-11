# Implementation Plan: Vibe Order Toggle

Property tests use fast-check, 100 runs, block-statement predicates, tagged
`Feature: Vibe order toggle, Property N: <desc>`.

## Tasks

- [ ] 1. Ranker parameter (R1)
  - [ ] 1.1 `packages/shared/constants/ranking.ts`: `ORDER_MODES`,
        `OrderMode`, `DEFAULT_ORDER_MODE`
    - _Requirements: 1.1_
  - [ ] 1.2 `vibeRank`: `orderMode` in `RankInput`; one comparator applies
        the two deltas in mode order; levels 3 to 6 untouched; doc comment
    - _Requirements: 1.1_
  - [ ] 1.3 `rankGetsByVibe(gets, orderMode)`; `rewards/repository.ts` and
        `rewards/service.ts` pass the viewer's stored mode from the
        existing `getUserById` read; `nearMeQuerySchema` unchanged
    - _Requirements: 1.2_
  - [ ] 1.4 `rankVenuesFromStores` passes `useUserStore.getState().orderMode`
    - _Requirements: 1.3_
  - [ ] 1.5 Properties 1, 2, 3 (`boostActive: false` pinned in 3);
        parameterise the four existing ranking test files over both
        modes, `crowd` reproducing today's expectations
    - _Requirements: 1.4, 5.1, 5.2, 5.3_

- [ ] 2. Preference (R3)
  - [ ] 2.1 User type, PATCH schema, GET response carry `orderMode`
    - _Requirements: 3.1, 3.2_
  - [ ] 2.2 `useUserStore`: top-level persisted `orderMode`,
        `setOrderMode`, reconcile in `setUser`, `clearUser` keeps it;
        failed PATCH keeps local and shows the toast
    - _Requirements: 2.3, 3.2_
  - [ ] 2.3 Unit tests: 400 on an unknown value; unset reads `busy`;
        reconcile both directions; logged-out change issues no PATCH
    - _Requirements: 3.1, 3.2_

- [ ] 3. Control (R2)
  - [ ] 3.1 `OrderModeControl.tsx` per design; i18n keys
        `map.order.busiest`, `map.order.crowd`, `map.order.saveFailed`
    - _Requirements: 2.1, 2.4, 2.5_
  - [ ] 3.2 Place in the Browse_Mode top row of `PeekCarousel.tsx`
        (non-empty branch only); back cue gains `min-h-11`; selection
        calls `recomputeOrder` with no camera move or scope change;
        Active_Venue preserved
    - _Requirements: 2.2, 2.3_
  - [ ] 3.3 Component test (jsdom) and Playwright per design
    - _Requirements: 5.4, 5.5_

- [ ] 4. Rules (R4)
  - [ ] 4.1 Update `discovery-dna-vibe-over-convenience.md`,
        `map-carousel.md`, `constellation-mode.md`; link decision 1;
        `pnpm sync:rules`
    - _Requirements: 4.1, 4.2_

- [ ] 5. Verification
  - [ ] 5.1 `pnpm typecheck && pnpm test && pnpm lint && pnpm format:check`
  - [ ] 5.2 `cone-invariants.test.ts` and `no-global-events-feed.test.ts`
        unchanged and green
