/**
 * Feature: North star alignment, Property 1: the board counts rooms.
 *
 * **Validates: Requirements 2.2**
 *
 * `rankLeaderboard` orders by distinct venues this week, then total check-ins,
 * then user id. Volume at one venue can never lift a guest above someone who
 * has been to more rooms.
 */

import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { rankLeaderboard, toLeaderboardRow } from '../leaderboard-rank.js'

const rowsArb = fc
  .array(fc.record({ venueCount: fc.integer({ min: 0, max: 12 }), checkInCount: fc.integer({ min: 0, max: 60 }) }), {
    maxLength: 30,
  })
  .map((rows) => rows.map((r, i) => ({ ...r, userId: `user-${String(i).padStart(2, '0')}` })))

describe('Feature: North star alignment, Property 1: leaderboard order', () => {
  it('puts more rooms first, then more check-ins, then the lower user id', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const ranked = rankLeaderboard(rows)
        for (let i = 1; i < ranked.length; i++) {
          const a = ranked[i - 1]!
          const b = ranked[i]!
          expect(a.venueCount).toBeGreaterThanOrEqual(b.venueCount)
          if (a.venueCount === b.venueCount) {
            expect(a.checkInCount).toBeGreaterThanOrEqual(b.checkInCount)
            if (a.checkInCount === b.checkInCount) expect(a.userId < b.userId).toBe(true)
          }
        }
      }),
      { numRuns: 200 },
    )
  })

  it('ranks 1..n over the whole set and is independent of input order', () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const ranked = rankLeaderboard(rows)
        expect(ranked.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1))
        expect(rankLeaderboard([...rows].reverse())).toEqual(ranked)
      }),
      { numRuns: 200 },
    )
  })

  it('reads the venues set size as the room count, and a row without one as zero', () => {
    expect(toLeaderboardRow({ userId: 'u', checkInCount: 5, venues: new Set(['a', 'b']) }).venueCount).toBe(2)
    expect(toLeaderboardRow({ userId: 'u', checkInCount: 5 }).venueCount).toBe(0)
  })
})
