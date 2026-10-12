import { ORDER_MODES } from '@area-code/shared/constants/ranking'
import * as fc from 'fast-check'
import { describe, it, expect } from 'vitest'

import {
  rankGetsByVibe,
  pulseStateFromScore,
  getTasteMatch,
  tierMultiplierFor,
  type GetRankSignals,
} from '../ranking.js'

/**
 * Gets feed ranking: ordering invariants, in both Order_Modes.
 *
 * These tests lock the discovery-DNA law
 * (`.kiro/steering/discovery-dna-vibe-over-convenience.md`) for the consumer
 * Get_Feed, which now mirrors the map carousel (`vibeRank`) signal-for-signal:
 *
 *   busy:  aliveness -> taste -> business tier -> has-live-gets -> proximity -> id
 *   crowd: taste -> aliveness -> business tier -> has-live-gets -> proximity -> id
 *
 * The same pure function (`rankGetsByVibe`) is what the repository/service use
 * to order the feed, so these exercise real behaviour. Each signal short-circuits
 * before the next, so a lower-priority signal can only break a higher-priority
 * tie, never invert it.
 */

const signalArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  tasteMatch: fc.integer({ min: 0, max: 5 }),
  aliveness: fc.double({ min: 0, max: 200, noNaN: true }),
  tierMultiplier: fc.constantFrom(1.0, 1.3, 1.6),
  hasLiveGets: fc.boolean(),
  distanceMeters: fc.double({ min: 0, max: 5000, noNaN: true }),
})

const uniqueByIdArb = fc
  .array(signalArb, { minLength: 1, maxLength: 30 })
  .map((arr) => arr.map((s, i) => ({ ...s, id: `${s.id}-${i}` })))

describe.each(ORDER_MODES)('rankGetsByVibe, %s order', (orderMode) => {
  const lead = (g: GetRankSignals) => (orderMode === 'busy' ? g.aliveness : g.tasteMatch)
  const next = (g: GetRankSignals) => (orderMode === 'busy' ? g.tasteMatch : g.aliveness)

  it('never ranks a weaker lead signal above a stronger one', () => {
    fc.assert(
      fc.property(uniqueByIdArb, (gets) => {
        const ranked = rankGetsByVibe(gets, orderMode)
        for (let i = 0; i < ranked.length - 1; i++) {
          expect(lead(ranked[i]!)).toBeGreaterThanOrEqual(lead(ranked[i + 1]!))
        }
      }),
      { numRuns: 200 },
    )
  })

  it('among an equal lead signal, never lets a weaker second signal outrank a stronger one', () => {
    fc.assert(
      fc.property(uniqueByIdArb, (gets) => {
        const ranked = rankGetsByVibe(gets, orderMode)
        for (let i = 0; i < ranked.length - 1; i++) {
          const a = ranked[i]!
          const b = ranked[i + 1]!
          if (lead(a) === lead(b)) {
            expect(next(a)).toBeGreaterThanOrEqual(next(b))
          }
        }
      }),
      { numRuns: 200 },
    )
  })

  it('among equal taste AND aliveness, a higher tier never ranks below a lower one', () => {
    fc.assert(
      fc.property(uniqueByIdArb, (gets) => {
        const ranked = rankGetsByVibe(gets, orderMode)
        for (let i = 0; i < ranked.length - 1; i++) {
          const a = ranked[i]!
          const b = ranked[i + 1]!
          if (a.tasteMatch === b.tasteMatch && a.aliveness === b.aliveness) {
            expect(a.tierMultiplier).toBeGreaterThanOrEqual(b.tierMultiplier)
          }
        }
      }),
      { numRuns: 200 },
    )
  })

  it('among equal taste/aliveness/tier, a live-gets venue never ranks below a non-live one', () => {
    fc.assert(
      fc.property(uniqueByIdArb, (gets) => {
        const ranked = rankGetsByVibe(gets, orderMode)
        for (let i = 0; i < ranked.length - 1; i++) {
          const a = ranked[i]!
          const b = ranked[i + 1]!
          if (a.tasteMatch === b.tasteMatch && a.aliveness === b.aliveness && a.tierMultiplier === b.tierMultiplier) {
            expect(a.hasLiveGets ? 1 : 0).toBeGreaterThanOrEqual(b.hasLiveGets ? 1 : 0)
          }
        }
      }),
      { numRuns: 200 },
    )
  })

  it('proximity only breaks ties between gets equal on every signal above it', () => {
    fc.assert(
      fc.property(uniqueByIdArb, (gets) => {
        const ranked = rankGetsByVibe(gets, orderMode)
        for (let i = 0; i < ranked.length - 1; i++) {
          const a = ranked[i]!
          const b = ranked[i + 1]!
          if (
            a.tasteMatch === b.tasteMatch &&
            a.aliveness === b.aliveness &&
            a.tierMultiplier === b.tierMultiplier &&
            a.hasLiveGets === b.hasLiveGets
          ) {
            expect(a.distanceMeters).toBeLessThanOrEqual(b.distanceMeters)
          }
        }
      }),
      { numRuns: 200 },
    )
  })

  it('the mode picks the winner between an on-taste get and a buzzing off-taste one', () => {
    const onTaste: GetRankSignals = {
      id: 'on-taste',
      tasteMatch: 2,
      aliveness: 10,
      tierMultiplier: 1.0,
      hasLiveGets: false,
      distanceMeters: 3000,
    }
    const buzzing: GetRankSignals = {
      id: 'buzzing',
      tasteMatch: 0,
      aliveness: 95,
      tierMultiplier: 1.6,
      hasLiveGets: true,
      distanceMeters: 50,
    }
    const ranked = rankGetsByVibe([buzzing, onTaste], orderMode)
    expect(ranked[0]!.id).toBe(orderMode === 'busy' ? 'buzzing' : 'on-taste')
  })

  it('a buzzing-but-further get beats a quiet-but-closer one when taste is equal', () => {
    const alive: GetRankSignals = {
      id: 'alive',
      tasteMatch: 0,
      aliveness: 95,
      tierMultiplier: 1.0,
      hasLiveGets: false,
      distanceMeters: 3000,
    }
    const close: GetRankSignals = {
      id: 'close',
      tasteMatch: 0,
      aliveness: 10,
      tierMultiplier: 1.0,
      hasLiveGets: false,
      distanceMeters: 50,
    }
    const ranked = rankGetsByVibe([close, alive], orderMode)
    expect(ranked[0]!.id).toBe('alive')
  })

  it('tier only breaks ties — it never outranks a more-alive or better-taste get', () => {
    const onTasteAlive: GetRankSignals = {
      id: 'free-but-alive',
      tasteMatch: 1,
      aliveness: 80,
      tierMultiplier: 1.0,
      hasLiveGets: false,
      distanceMeters: 100,
    }
    const paidButDead: GetRankSignals = {
      id: 'paid-but-dead',
      tasteMatch: 0,
      aliveness: 5,
      tierMultiplier: 1.6,
      hasLiveGets: true,
      distanceMeters: 100,
    }
    const ranked = rankGetsByVibe([paidButDead, onTasteAlive], orderMode)
    expect(ranked[0]!.id).toBe('free-but-alive')
  })

  it('is deterministic and total — same input, same order; no items lost', () => {
    fc.assert(
      fc.property(uniqueByIdArb, (gets) => {
        const a = rankGetsByVibe(gets, orderMode).map((g) => g.id)
        const b = rankGetsByVibe(gets, orderMode).map((g) => g.id)
        expect(a).toEqual(b)
        expect([...a].sort()).toEqual([...gets.map((g) => g.id)].sort())
      }),
      { numRuns: 100 },
    )
  })

  it('does not mutate the input array', () => {
    const gets: GetRankSignals[] = [
      { id: 'a', tasteMatch: 0, aliveness: 1, tierMultiplier: 1, hasLiveGets: false, distanceMeters: 100 },
      { id: 'b', tasteMatch: 0, aliveness: 2, tierMultiplier: 1, hasLiveGets: false, distanceMeters: 200 },
    ]
    const snapshot = gets.map((g) => g.id)
    rankGetsByVibe(gets, orderMode)
    expect(gets.map((g) => g.id)).toEqual(snapshot)
  })
})

describe('getTasteMatch — archetype affinity + friends present', () => {
  it('archetype match adds 1, friends add their count, no archetype is 0', () => {
    expect(getTasteMatch('archetype-nomad', 'archetype-nomad', 0)).toBe(1)
    expect(getTasteMatch('archetype-nomad', 'archetype-eclectic', 0)).toBe(0)
    expect(getTasteMatch(null, 'archetype-nomad', 0)).toBe(0)
    expect(getTasteMatch('archetype-nomad', 'archetype-nomad', 3)).toBe(4)
    expect(getTasteMatch(null, 'archetype-eclectic', 2)).toBe(2)
  })
})

describe('tierMultiplierFor — tier weight resolution', () => {
  it('maps tiers to weights and falls back to neutral 1.0', () => {
    expect(tierMultiplierFor('free')).toBe(1.0)
    expect(tierMultiplierFor('starter')).toBe(1.0)
    expect(tierMultiplierFor('payg')).toBe(1.0)
    expect(tierMultiplierFor('growth')).toBe(1.3)
    expect(tierMultiplierFor('pro')).toBe(1.6)
    expect(tierMultiplierFor(undefined)).toBe(1.0)
    expect(tierMultiplierFor('mystery')).toBe(1.0)
  })
})

describe('pulseStateFromScore — band mapping', () => {
  it('maps scores to the same bands the map uses', () => {
    expect(pulseStateFromScore(0)).toBe('dormant')
    expect(pulseStateFromScore(5)).toBe('quiet')
    expect(pulseStateFromScore(20)).toBe('active')
    expect(pulseStateFromScore(45)).toBe('buzzing')
    expect(pulseStateFromScore(80)).toBe('popping')
  })
})
