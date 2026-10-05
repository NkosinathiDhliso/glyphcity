/**
 * Feature: GlyphCity rebrand, Property 10: Entrance_Pin bound.
 *
 * An entrance pin is accepted exactly when it lies within 75 m of the venue
 * pin, so a Point_Mode beam can never be dragged onto a different building.
 * Entrances are generated at a known distance and bearing from venues across
 * South Africa's latitudes.
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { ENTRANCE_MAX_DISTANCE_METRES, entranceWithinBound } from '../entrance'

const EARTH_RADIUS_M = 6_371_000

/** Point `metres` away from `origin` along `bearingDeg` on a sphere. */
function offset(origin: { lat: number; lng: number }, metres: number, bearingDeg: number) {
  const d = metres / EARTH_RADIUS_M
  const b = (bearingDeg * Math.PI) / 180
  const lat1 = (origin.lat * Math.PI) / 180
  const lng1 = (origin.lng * Math.PI) / 180
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b))
  const lng2 =
    lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI }
}

const venueArb = fc.record({
  lat: fc.double({ min: -35, max: -22, noNaN: true }),
  lng: fc.double({ min: 16, max: 33, noNaN: true }),
})
// Skip a hair either side of the bound, where float rounding decides.
const distanceArb = fc
  .double({ min: 0, max: 400, noNaN: true })
  .filter((d) => Math.abs(d - ENTRANCE_MAX_DISTANCE_METRES) > 0.01)
const bearingArb = fc.double({ min: 0, max: 360, noNaN: true })

describe('Feature: GlyphCity rebrand, Property 10: entranceWithinBound', () => {
  it('accepts an entrance if and only if it is within 75 m of the venue', () => {
    fc.assert(
      fc.property(venueArb, distanceArb, bearingArb, (venue, metres, bearing) => {
        const entrance = offset(venue, metres, bearing)
        expect(entranceWithinBound(venue, entrance)).toBe(metres <= ENTRANCE_MAX_DISTANCE_METRES)
      }),
      { numRuns: 300 },
    )
  })
})
