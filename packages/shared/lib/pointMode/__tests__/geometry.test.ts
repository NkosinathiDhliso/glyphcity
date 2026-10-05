import { describe, expect, it } from 'vitest'

import { checkSignal } from '../accuracy'
import { POINT_MODE_HORIZON_RATIO } from '../constants'
import { bearingTo, depthScale, distanceTo, groundY, relativeAngle } from '../geometry'

describe('bearingTo', () => {
  it('reads north, east, south and west', () => {
    const o = { lat: 0, lng: 0 }
    expect(bearingTo(o, { lat: 1, lng: 0 })).toBeCloseTo(0, 6)
    expect(bearingTo(o, { lat: 0, lng: 1 })).toBeCloseTo(90, 6)
    expect(bearingTo(o, { lat: -1, lng: 0 })).toBeCloseTo(180, 6)
    expect(bearingTo(o, { lat: 0, lng: -1 })).toBeCloseTo(270, 6)
  })
})

describe('distanceTo', () => {
  it('measures metres along a street (Fox St, Maboneng, about 100 m apart)', () => {
    const a = { lat: -26.20467, lng: 28.05941 }
    const b = { lat: -26.20467, lng: 28.06041 }
    expect(distanceTo(a, b)).toBeGreaterThan(95)
    expect(distanceTo(a, b)).toBeLessThan(105)
  })
})

describe('relativeAngle', () => {
  it('wraps across north', () => {
    expect(relativeAngle(10, 350)).toBeCloseTo(20)
    expect(relativeAngle(350, 10)).toBeCloseTo(-20)
    expect(relativeAngle(180, 0)).toBeCloseTo(180)
    expect(relativeAngle(0, 0)).toBe(0)
  })
})

describe('depthScale and groundY', () => {
  it('shrinks and rises toward the horizon with distance', () => {
    expect(depthScale(0)).toBe(1)
    expect(depthScale(10_000)).toBe(0.35)
    expect(depthScale(50)).toBeGreaterThan(depthScale(150))
    expect(groundY(0, 800)).toBe(800)
    expect(groundY(100, 800)).toBeLessThan(groundY(20, 800))
    expect(groundY(1e9, 800)).toBeGreaterThanOrEqual(800 * POINT_MODE_HORIZON_RATIO)
  })
})

describe('checkSignal', () => {
  it('places beams only with a good GPS fix and a reported compass', () => {
    expect(checkSignal({ gpsAccuracyMetres: 12, headingAccuracyDeg: 10 })).toEqual({ ok: true })
    expect(checkSignal({ gpsAccuracyMetres: 35, headingAccuracyDeg: 25 })).toEqual({ ok: true })
    expect(checkSignal({ gpsAccuracyMetres: 36, headingAccuracyDeg: 10 })).toEqual({ ok: false, reason: 'gps' })
    expect(checkSignal({ gpsAccuracyMetres: null, headingAccuracyDeg: 10 })).toEqual({ ok: false, reason: 'gps' })
    expect(checkSignal({ gpsAccuracyMetres: 12, headingAccuracyDeg: 26 })).toEqual({ ok: false, reason: 'heading' })
    expect(checkSignal({ gpsAccuracyMetres: 12, headingAccuracyDeg: null })).toEqual({ ok: false, reason: 'heading' })
  })
})
