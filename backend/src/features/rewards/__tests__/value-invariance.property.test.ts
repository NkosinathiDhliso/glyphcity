/**
 * Feature: North star alignment, Property 4: `rankGetsByVibe` ignores what a
 * get is worth.
 *
 * **Validates: Requirements 5.2**
 *
 * Gets are the cherry, not a deals catalog. The near-me order is taste,
 * aliveness, tier, live gets, distance, id, and nothing about the get's value
 * may move it. The repository spreads the whole candidate row into the ranking
 * input, so value, discount, title and description travel with every item;
 * this proves the order is blind to them.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { rankGetsByVibe, type GetRankSignals } from '../ranking.js'

interface PricedGet extends GetRankSignals {
  value: number
  discount: number
  title: string
  description: string
}

const pricedFieldsArb = fc.record({
  value: fc.integer({ min: 0, max: 100_000 }),
  discount: fc.integer({ min: 0, max: 100 }),
  title: fc.string({ maxLength: 40 }),
  description: fc.string({ maxLength: 120 }),
})

const getArb = fc
  .record({
    tasteMatch: fc.integer({ min: 0, max: 5 }),
    aliveness: fc.integer({ min: 0, max: 200 }),
    tierMultiplier: fc.constantFrom(1.0, 1.3, 1.6),
    hasLiveGets: fc.boolean(),
    distanceMeters: fc.integer({ min: 0, max: 5000 }),
  })
  .chain((signals) => pricedFieldsArb.map((priced) => ({ ...signals, ...priced })))

const getsArb = fc
  .array(getArb, { minLength: 1, maxLength: 25 })
  .map((gets): PricedGet[] => gets.map((g, i) => ({ ...g, id: `get-${i}` })))

describe('Feature: North star alignment, Property 4: rankGetsByVibe value invariance', () => {
  it('returns the same id order under any change to value, discount, title or description', () => {
    fc.assert(
      fc.property(getsArb, fc.array(pricedFieldsArb, { minLength: 25, maxLength: 25 }), (gets, replacements) => {
        const repriced = gets.map((g, i) => ({ ...g, ...replacements[i]! }))

        const before = rankGetsByVibe(gets).map((g) => g.id)
        const after = rankGetsByVibe(repriced).map((g) => g.id)

        expect(after).toEqual(before)
      }),
      { numRuns: 200 },
    )
  })
})
