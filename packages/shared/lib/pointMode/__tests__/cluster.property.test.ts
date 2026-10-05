/**
 * Feature: GlyphCity rebrand, Property 7: Point_Mode cluster safety.
 *
 * No two separate labels sit closer in angle than the compass can resolve, so
 * the camera view never shows two doors it cannot tell apart as if it could.
 * Every venue appears exactly once, and each stack keeps vibeRank order.
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { clusterByAngle, clusterGapDeg } from '../cluster'

const inViewArb = fc
  .array(fc.double({ min: -30, max: 30, noNaN: true }), { minLength: 0, maxLength: 25 })
  .map((rels) => rels.map((rel, i) => ({ venue: `v${i}`, rel, rank: i })))
const accuracyArb = fc.double({ min: 0, max: 40, noNaN: true })

describe('Feature: GlyphCity rebrand, Property 7: clusterByAngle', () => {
  it('keeps separate labels at least the accuracy floor apart', () => {
    fc.assert(
      fc.property(inViewArb, accuracyArb, (inView, accuracy) => {
        const stacks = clusterByAngle(inView, accuracy)
        const gap = clusterGapDeg(accuracy)
        for (let i = 1; i < stacks.length; i++) {
          expect(stacks[i]!.rel - stacks[i - 1]!.rel).toBeGreaterThanOrEqual(gap - 1e-9)
        }
      }),
      { numRuns: 300 },
    )
  })

  it('places every venue exactly once, in rank order within a stack', () => {
    fc.assert(
      fc.property(inViewArb, accuracyArb, (inView, accuracy) => {
        const stacks = clusterByAngle(inView, accuracy)
        const all = stacks.flatMap((s) => s.venues)
        expect([...all].sort()).toEqual(inView.map((v) => v.venue).sort())
        const rankOf = new Map(inView.map((v) => [v.venue, v.rank]))
        for (const s of stacks) {
          const ranks = s.venues.map((v) => rankOf.get(v)!)
          expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
        }
      }),
      { numRuns: 300 },
    )
  })
})
