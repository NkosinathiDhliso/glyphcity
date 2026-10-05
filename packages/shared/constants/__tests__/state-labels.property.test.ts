/**
 * Feature: GlyphCity rebrand, Property 2: label honesty (shared bands).
 *
 * `nodeStateFromScore` is the band oracle every label producer is checked
 * against, so it must agree with the pulse-decay worker and its label rank must
 * never fall as the score rises. Also guards R2.7: no Plain_Scale word claims
 * capacity.
 *
 * **Validates: Requirements 2.6, 2.7**
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import type { NodeState } from '../../types'
import { PLAIN_SCALE_EN, nodeStateFromScore, stateLabelKey, type StateLabelKey } from '../state-labels'

/**
 * Pinned from `STATE_THRESHOLDS` in `backend/src/workers/pulse-decay.ts`
 * (not exported there). Update both together, or this test fails.
 */
const PULSE_DECAY_BANDS: ReadonlyArray<{ min: number; state: NodeState }> = [
  { min: 61, state: 'popping' },
  { min: 31, state: 'buzzing' },
  { min: 11, state: 'active' },
  { min: 1, state: 'quiet' },
  { min: 0, state: 'dormant' },
]

/** Same loop as `getNodeState` in `pulse-decay.ts`. */
function pulseDecayState(score: number): NodeState {
  for (const t of PULSE_DECAY_BANDS) {
    if (score >= t.min) return t.state
  }
  return 'dormant'
}

/** Plain_Scale rank: invite 0, then Quiet to Very busy. */
const LABEL_RANK: Record<StateLabelKey, number> = {
  'state.firstIn': 0,
  'state.quiet': 1,
  'state.aLittleBusy': 2,
  'state.busy': 3,
  'state.veryBusy': 4,
}

const CAPACITY_WORDS = /\b(packed|full|rammed)\b/i

const scoreArb = fc.oneof(fc.double({ min: -50, max: 500, noNaN: true }), fc.integer({ min: -50, max: 500 }))

describe('Feature: GlyphCity rebrand, Property 2: label honesty', () => {
  it('shared bands agree with the pulse-decay worker bands for any score', () => {
    fc.assert(
      fc.property(scoreArb, (score) => {
        expect(nodeStateFromScore(score)).toBe(pulseDecayState(score))
      }),
      { numRuns: 300 },
    )
  })

  it('label rank is monotone non-decreasing in pulse score', () => {
    fc.assert(
      fc.property(scoreArb, scoreArb, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a]
        const loRank = LABEL_RANK[stateLabelKey(nodeStateFromScore(lo))]
        const hiRank = LABEL_RANK[stateLabelKey(nodeStateFromScore(hi))]
        expect(loRank).toBeLessThanOrEqual(hiRank)
      }),
      { numRuns: 300 },
    )
  })

  it('no Plain_Scale value claims capacity', () => {
    for (const value of Object.values(PLAIN_SCALE_EN)) {
      expect(value).not.toMatch(CAPACITY_WORDS)
    }
  })
})
