/**
 * Feature: GlyphCity rebrand, Property 3: label parity
 *
 * The share snapshot renders the same State_Label the apps show for every
 * Pulse_State band. `PLAIN_SCALE_EN` is the source of truth; its parity with
 * each app `en.json` is pinned in
 * `packages/shared/constants/__tests__/state-labels.parity.property.test.ts`.
 *
 * **Validates: Requirements 2.1**
 */
import { PLAIN_SCALE_EN, stateLabelKey } from '@area-code/shared/constants/state-labels'
import type { NodeState } from '@area-code/shared/types'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { buildShareSnapshot } from '../share-snapshot.js'

const ALL_STATES: NodeState[] = ['dormant', 'quiet', 'active', 'buzzing', 'popping']

/** A pulse score inside each Pulse_State band. */
const BAND_SCORE: Record<NodeState, number> = {
  dormant: 0,
  quiet: 5,
  active: 20,
  buzzing: 45,
  popping: 80,
}

const NUM_RUNS = 100

describe('Feature: GlyphCity rebrand, Property 3: label parity', () => {
  it('share-snapshot renders the app label for every band', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_STATES), fc.integer({ min: 1, max: 500 }), (state, live) => {
        // Someone is there, so dormant reads quiet (share-snapshot honesty rule).
        const shown: NodeState = state === 'dormant' ? 'quiet' : state
        const line = buildShareSnapshot({
          name: 'Venue',
          pulseScore: BAND_SCORE[state],
          liveCheckInCount: live,
          activeRewardCount: 0,
          tonight: null,
        })
        const label = line.split(' \u00b7 ')[1]
        expect(label).toBe(PLAIN_SCALE_EN[stateLabelKey(shown)])
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('an empty, dormant venue renders the first-in invite', () => {
    const empty = buildShareSnapshot({
      name: 'Venue',
      pulseScore: 0,
      liveCheckInCount: 0,
      activeRewardCount: 0,
      tonight: null,
    })
    expect(empty).toBe(`Venue \u00b7 ${PLAIN_SCALE_EN[stateLabelKey('dormant')]}`)
  })
})
