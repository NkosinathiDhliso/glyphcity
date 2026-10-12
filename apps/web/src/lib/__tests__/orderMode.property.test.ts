/**
 * Feature: Vibe order toggle, Properties 1 to 3.
 *
 * The Order_Mode swaps the top two levels of `vibeRank` and nothing else:
 *
 *   1. `busy` puts aliveness before taste, `crowd` puts taste before aliveness,
 *      and two venues that tie on both keep the same relative order in either.
 *   2. Distance never decides between two venues that differ on either top
 *      level, in either mode (`discovery-dna-vibe-over-convenience.md`).
 *   3. The backend `rankGetsByVibe` agrees with `vibeRank` on the same signals,
 *      with `boostActive: false` pinned (the backend signal set has none).
 *
 * Validates: vibe-order-toggle Requirements 1.4, 5.1, 5.2, 5.3
 */

import { TIER_SIZE_MULTIPLIER } from '@area-code/shared/constants'
import { ORDER_MODES, type OrderMode } from '@area-code/shared/constants/ranking'
import type { BusinessTier, Node } from '@area-code/shared/types'
import * as fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { rankGetsByVibe, tierMultiplierFor } from '../../../../../backend/src/features/rewards/ranking'
import { haversineMeters, tasteMatchScore, vibeRank, type RankInput } from '../carouselRanking'

const ORIGIN = { lat: -26.2041, lng: 28.0473 }
const ARCHETYPES = ['archetype-a', 'archetype-b', 'archetype-c']
const TIERS: BusinessTier[] = ['free', 'starter', 'payg', 'growth', 'pro']

interface VenueSignals {
  id: string
  dLat: number
  dLng: number
  pulse: number
  count: number
  archetype: string
  friends: number
  tier: BusinessTier
  boost: boolean
  liveGets: boolean
}

// Small ranges so ties on every level are common and each level gets exercised.
const venueArb: fc.Arbitrary<VenueSignals> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 4 }),
  dLat: fc.integer({ min: -3, max: 3 }).map((n) => n * 0.01),
  dLng: fc.integer({ min: -3, max: 3 }).map((n) => n * 0.01),
  pulse: fc.nat({ max: 4 }),
  count: fc.nat({ max: 3 }),
  archetype: fc.constantFrom(...ARCHETYPES),
  friends: fc.nat({ max: 2 }),
  tier: fc.constantFrom(...TIERS),
  boost: fc.boolean(),
  liveGets: fc.boolean(),
})

const scenarioArb = fc.record({
  venues: fc.uniqueArray(venueArb, { minLength: 2, maxLength: 8, selector: (v) => v.id }),
  consumerArchetypeId: fc.option(fc.constantFrom(...ARCHETYPES), { nil: null }),
  positionFresh: fc.boolean(),
  orderMode: fc.constantFrom(...ORDER_MODES),
})

type Scenario = typeof scenarioArb extends fc.Arbitrary<infer S> ? S : never

function toNode(v: VenueSignals, boost: boolean): Node {
  return {
    id: v.id,
    name: v.id,
    slug: v.id,
    category: 'nightlife',
    lat: ORIGIN.lat + v.dLat,
    lng: ORIGIN.lng + v.dLng,
    cityId: 'city-jhb',
    businessId: `b-${v.id}`,
    submittedBy: null,
    claimStatus: 'claimed',
    claimCipcStatus: null,
    nodeColour: '#000000',
    nodeIcon: null,
    qrCheckinEnabled: true,
    isVerified: true,
    isActive: true,
    createdAt: '2026-10-01T00:00:00.000Z',
    businessTier: v.tier,
    boostActive: boost,
  } as Node
}

function buildInput(s: Scenario, opts: { orderMode: OrderMode; positionFresh?: boolean; pinBoost?: boolean }) {
  const pulseScores: Record<string, number> = {}
  const checkInCounts: Record<string, number> = {}
  const venueArchetypeIds: Record<string, string> = {}
  const friendsAtVenue: Record<string, string[]> = {}
  const hasLiveGets: Record<string, boolean> = {}
  for (const v of s.venues) {
    pulseScores[v.id] = v.pulse
    checkInCounts[v.id] = v.count
    venueArchetypeIds[v.id] = v.archetype
    friendsAtVenue[v.id] = Array.from({ length: v.friends }, (_, i) => `u${i}`)
    hasLiveGets[v.id] = v.liveGets
  }
  const input: RankInput = {
    venues: s.venues.map((v) => toNode(v, opts.pinBoost ? false : v.boost)),
    pulseScores,
    checkInCounts,
    lastKnownPosition: ORIGIN,
    positionFresh: opts.positionFresh ?? s.positionFresh,
    consumerArchetypeId: s.consumerArchetypeId,
    venueArchetypeIds,
    friendsAtVenue,
    hasLiveGets,
    orderMode: opts.orderMode,
  }
  return input
}

function tasteOf(s: Scenario, v: VenueSignals): number {
  return tasteMatchScore(s.consumerArchetypeId, v.archetype, v.friends)
}

function aliveOf(v: VenueSignals): number {
  return v.pulse + v.count
}

/** Position of every id in an ordering. */
function indexOf(ids: string[]): Map<string, number> {
  return new Map(ids.map((id, i) => [id, i]))
}

/** Every unordered pair of venues in the scenario. */
function pairs(s: Scenario): Array<[VenueSignals, VenueSignals]> {
  const out: Array<[VenueSignals, VenueSignals]> = []
  s.venues.forEach((a, i) => s.venues.slice(i + 1).forEach((b) => out.push([a, b])))
  return out
}

const RUNS = { numRuns: 200 }

describe('Feature: Vibe order toggle, Property 1: mode semantics and lower-level equality', () => {
  it('leads with aliveness in busy and taste in crowd', () => {
    fc.assert(
      fc.property(scenarioArb, (s) => {
        const pos = indexOf(vibeRank(buildInput(s, { orderMode: s.orderMode })).map((v) => v.id))
        const lead = (v: VenueSignals) => (s.orderMode === 'busy' ? aliveOf(v) : tasteOf(s, v))
        const next = (v: VenueSignals) => (s.orderMode === 'busy' ? tasteOf(s, v) : aliveOf(v))

        for (const [a, b] of pairs(s)) {
          const aFirst = pos.get(a.id)! < pos.get(b.id)!
          if (lead(a) !== lead(b)) {
            expect(aFirst).toBe(lead(a) > lead(b))
          } else if (next(a) !== next(b)) {
            expect(aFirst).toBe(next(a) > next(b))
          }
        }
      }),
      RUNS,
    )
  })

  it('orders venues that tie on taste and aliveness the same way in both modes', () => {
    fc.assert(
      fc.property(scenarioArb, (s) => {
        const busy = indexOf(vibeRank(buildInput(s, { orderMode: 'busy' })).map((v) => v.id))
        const crowd = indexOf(vibeRank(buildInput(s, { orderMode: 'crowd' })).map((v) => v.id))

        for (const [a, b] of pairs(s)) {
          if (tasteOf(s, a) !== tasteOf(s, b) || aliveOf(a) !== aliveOf(b)) continue
          expect(busy.get(a.id)! < busy.get(b.id)!).toBe(crowd.get(a.id)! < crowd.get(b.id)!)
        }
      }),
      RUNS,
    )
  })
})

describe('Feature: Vibe order toggle, Property 2: distance never decides across a top-two difference', () => {
  it.each(ORDER_MODES)('keeps every top-two decision when the position goes stale (%s)', (orderMode) => {
    fc.assert(
      fc.property(scenarioArb, (s) => {
        const near = indexOf(vibeRank(buildInput(s, { orderMode, positionFresh: true })).map((v) => v.id))
        const none = indexOf(vibeRank(buildInput(s, { orderMode, positionFresh: false })).map((v) => v.id))

        for (const [a, b] of pairs(s)) {
          if (tasteOf(s, a) === tasteOf(s, b) && aliveOf(a) === aliveOf(b)) continue
          expect(near.get(a.id)! < near.get(b.id)!).toBe(none.get(a.id)! < none.get(b.id)!)
        }
      }),
      RUNS,
    )
  })
})

describe('Feature: Vibe order toggle, Property 3: front and back rankers agree', () => {
  it.each(ORDER_MODES)('rankGetsByVibe matches vibeRank on the same signals, boost pinned off (%s)', (orderMode) => {
    fc.assert(
      fc.property(scenarioArb, (s) => {
        const front = vibeRank(buildInput(s, { orderMode, positionFresh: true, pinBoost: true })).map((v) => v.id)
        const gets = s.venues.map((v) => ({
          id: v.id,
          tasteMatch: tasteOf(s, v),
          aliveness: aliveOf(v),
          tierMultiplier: tierMultiplierFor(v.tier),
          hasLiveGets: v.liveGets,
          distanceMeters: haversineMeters(ORIGIN, { lat: ORIGIN.lat + v.dLat, lng: ORIGIN.lng + v.dLng }),
        }))
        const back = rankGetsByVibe(gets, orderMode).map((g) => g.id)

        expect(back).toEqual(front)
      }),
      RUNS,
    )
  })

  it('weights tier identically on both sides', () => {
    for (const tier of TIERS) {
      expect(tierMultiplierFor(tier)).toBe(TIER_SIZE_MULTIPLIER[tier])
    }
  })
})
