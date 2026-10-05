/**
 * Feature: GlyphCity rebrand, Property 8: ranking parity.
 *
 * The venues Point_Mode shows are an order-preserving subset of `vibeRank`
 * for the same inputs, every stack lists its venues in `vibeRank` order, and
 * moving the observer never reorders them: distance only scales size.
 *
 * Membership is applied server-side (`getNodesByCitySlug` returns paid-tier,
 * active nodes only) and the client renders the city payload as-is, so the
 * generator emits members only and non-member filtering is not tested here.
 *
 * **Validates: Requirements 8.2**
 */
import { POINT_MODE_FOV_DEG, POINT_MODE_RADIUS_METRES } from '@area-code/shared/lib/pointMode/constants'
import { distanceTo, depthScale, project, relativeAngle, bearingTo } from '@area-code/shared/lib/pointMode/geometry'
import { placeVenues, pointTarget, type PointModeView } from '@area-code/shared/lib/pointMode/view'
import type { BusinessTier, Node, NodeCategory } from '@area-code/shared/types'
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { RECOMMENDED_LIMIT } from '../carouselConstants'
import { vibeRank, type RankInput } from '../carouselRanking'

const ORIGIN = { lat: -26.2041, lng: 28.0473 }
const M_PER_DEG_LAT = 111_320
const M_PER_DEG_LNG = M_PER_DEG_LAT * Math.cos((ORIGIN.lat * Math.PI) / 180)
const WIDTH = 390
const HEIGHT = 844
const ARCHETYPES = ['archetype-a', 'archetype-b', 'archetype-c']
const PAID_TIERS: BusinessTier[] = ['starter', 'payg', 'growth', 'pro']
const CATEGORIES: NodeCategory[] = ['food', 'coffee', 'nightlife', 'retail', 'fitness', 'arts']

function offset(base: { lat: number; lng: number }, dx: number, dy: number) {
  return { lat: base.lat + dy / M_PER_DEG_LAT, lng: base.lng + dx / M_PER_DEG_LNG }
}

const metres = (max: number) => fc.double({ min: -max, max, noNaN: true })

const venueArb = fc.record({
  dx: metres(350),
  dy: metres(350),
  entrance: fc.option(fc.record({ dx: metres(50), dy: metres(50) }), { nil: undefined }),
  pulse: fc.integer({ min: 0, max: 5 }),
  count: fc.integer({ min: 0, max: 3 }),
  tier: fc.constantFrom(...PAID_TIERS),
  boost: fc.boolean(),
  archetype: fc.constantFrom(...ARCHETYPES),
  liveGets: fc.boolean(),
  friends: fc.integer({ min: 0, max: 2 }),
  category: fc.constantFrom(...CATEGORIES),
})

const scenarioArb = fc.record({
  venues: fc.array(venueArb, { minLength: 0, maxLength: 40 }),
  observer: fc.record({ dx: metres(100), dy: metres(100) }),
  move: fc.record({ dx: metres(120), dy: metres(120) }),
  heading: fc.double({ min: 0, max: 359.999, noNaN: true }),
  headingAccuracy: fc.double({ min: 0, max: 25, noNaN: true }),
  consumerArchetype: fc.option(fc.constantFrom(...ARCHETYPES), { nil: null }),
  rankPosition: fc.option(fc.record({ dx: metres(500), dy: metres(500) }), { nil: null }),
  positionFresh: fc.boolean(),
})

type Scenario = typeof scenarioArb extends fc.Arbitrary<infer S> ? S : never

/** Paid-tier, active, owned nodes: what the city payload carries. */
function buildRankInput(s: Scenario): RankInput {
  const pulseScores: Record<string, number> = {}
  const checkInCounts: Record<string, number> = {}
  const venueArchetypeIds: Record<string, string> = {}
  const friendsAtVenue: Record<string, string[]> = {}
  const hasLiveGets: Record<string, boolean> = {}
  const venues: Node[] = s.venues.map((v, i) => {
    const id = `v${String(i).padStart(2, '0')}`
    const pos = offset(ORIGIN, v.dx, v.dy)
    pulseScores[id] = v.pulse
    checkInCounts[id] = v.count
    venueArchetypeIds[id] = v.archetype
    friendsAtVenue[id] = Array.from({ length: v.friends }, (_, f) => `u${f}`)
    hasLiveGets[id] = v.liveGets
    const node = {
      id,
      name: `Venue ${id}`,
      slug: id,
      category: v.category,
      lat: pos.lat,
      lng: pos.lng,
      cityId: 'johannesburg',
      businessId: `b-${id}`,
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
      boostActive: v.boost,
      ...(v.entrance ? { entrance: offset(pos, v.entrance.dx, v.entrance.dy) } : {}),
    } as Node
    return node
  })
  return {
    venues,
    pulseScores,
    checkInCounts,
    lastKnownPosition: s.rankPosition ? offset(ORIGIN, s.rankPosition.dx, s.rankPosition.dy) : null,
    positionFresh: s.positionFresh,
    consumerArchetypeId: s.consumerArchetype,
    venueArchetypeIds,
    friendsAtVenue,
    hasLiveGets,
  }
}

function view(ranked: Node[], position: { lat: number; lng: number }, s: Scenario): PointModeView<Node> {
  return placeVenues({
    ranked,
    position,
    headingDeg: s.heading,
    headingAccuracyDeg: s.headingAccuracy,
    width: WIDTH,
    height: HEIGHT,
    limit: RECOMMENDED_LIMIT,
  })
}

function expectSubsequence(sub: string[], full: string[]): void {
  let j = 0
  for (const id of sub) {
    while (j < full.length && full[j] !== id) j++
    expect(j, `${id} out of vibeRank order`).toBeLessThan(full.length)
    j++
  }
}

function inFrame(node: Node, position: { lat: number; lng: number }, heading: number): boolean {
  const target = pointTarget(node)
  if (distanceTo(position, target) > POINT_MODE_RADIUS_METRES) return false
  return project(relativeAngle(bearingTo(position, target), heading), POINT_MODE_FOV_DEG, WIDTH) !== null
}

function expectSizeFromDistance(v: PointModeView<Node>, position: { lat: number; lng: number }): void {
  for (const p of v.stacks.flatMap((st) => st.venues)) {
    expect(p.distanceMetres).toBeCloseTo(distanceTo(position, pointTarget(p.venue)), 6)
    expect(p.scale).toBe(depthScale(p.distanceMetres))
  }
}

const RUNS = { numRuns: 200 }

describe('Feature: GlyphCity rebrand, Property 8: ranking parity', () => {
  it('shows an order-preserving subset of vibeRank, within radius, FOV and the cap', () => {
    fc.assert(
      fc.property(scenarioArb, (s) => {
        const ranked = vibeRank(buildRankInput(s))
        const rankedIds = ranked.map((n) => n.id)
        const observer = offset(ORIGIN, s.observer.dx, s.observer.dy)
        const v = view(ranked, observer, s)

        // (a) the rank-ordered list and every stack are subsequences of vibeRank
        const shownIds = v.ranked.map((n) => n.id)
        expectSubsequence(shownIds, rankedIds)
        for (const stack of v.stacks) {
          expectSubsequence(
            stack.venues.map((p) => p.venue.id),
            rankedIds,
          )
        }
        const stackIds = v.stacks.flatMap((st) => st.venues.map((p) => p.venue.id))
        expect([...stackIds].sort()).toEqual([...shownIds].sort())

        // (b) every shown venue is inside the radius and the FOV, by its target
        for (const node of v.ranked) {
          expect(inFrame(node, observer, s.heading)).toBe(true)
        }

        // (c) the beam cap
        expect(stackIds.length).toBeLessThanOrEqual(RECOMMENDED_LIMIT)

        // Visibility never skips rank: an in-frame venue ranked above a shown one is shown too.
        const lastShown = shownIds.length ? rankedIds.indexOf(shownIds[shownIds.length - 1]!) : -1
        const shown = new Set(shownIds)
        for (const node of ranked.slice(0, lastShown + 1)) {
          if (inFrame(node, observer, s.heading)) expect(shown.has(node.id)).toBe(true)
        }
      }),
      RUNS,
    )
  })

  it('never reorders when the observer moves; distance only scales size', () => {
    fc.assert(
      fc.property(scenarioArb, (s) => {
        const ranked = vibeRank(buildRankInput(s))
        const a = offset(ORIGIN, s.observer.dx, s.observer.dy)
        const b = offset(a, s.move.dx, s.move.dy)
        const va = view(ranked, a, s)
        const vb = view(ranked, b, s)

        // (d) venues visible from both spots keep the same relative order
        const idsA = va.ranked.map((n) => n.id)
        const idsB = vb.ranked.map((n) => n.id)
        const inA = new Set(idsA)
        const inB = new Set(idsB)
        expect(idsB.filter((id) => inA.has(id))).toEqual(idsA.filter((id) => inB.has(id)))

        // Size is a function of distance alone.
        expectSizeFromDistance(va, a)
        expectSizeFromDistance(vb, b)
      }),
      RUNS,
    )
  })
})
