/**
 * Feature: GlyphCity rebrand, Property 6: Point_Mode projection.
 *
 * A venue appears on the camera view exactly when it is inside the field of
 * view, and further right in the world is always further right on screen.
 */
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { project, relativeAngle } from '../geometry'

const fovArb = fc.double({ min: 30, max: 120, noNaN: true })
const relArb = fc.double({ min: -180, max: 180, noNaN: true })
const widthArb = fc.integer({ min: 200, max: 2000 })

describe('Feature: GlyphCity rebrand, Property 6: project', () => {
  it('returns null exactly when the relative angle exceeds half the field of view', () => {
    fc.assert(
      fc.property(relArb, fovArb, widthArb, (rel, fov, width) => {
        const x = project(rel, fov, width)
        expect(x === null).toBe(Math.abs(rel) > fov / 2)
        if (x !== null) {
          expect(x).toBeGreaterThanOrEqual(0)
          expect(x).toBeLessThanOrEqual(width)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('is monotone in the relative angle inside the field of view', () => {
    fc.assert(
      fc.property(relArb, relArb, fovArb, widthArb, (a, b, fov, width) => {
        // Angles a few ulps apart can round to the same pixel; strictness is
        // only meaningful above floating-point noise.
        fc.pre(b - a > 1e-9)
        const xa = project(a, fov, width)
        const xb = project(b, fov, width)
        fc.pre(xa !== null && xb !== null)
        expect(xa!).toBeLessThan(xb!)
      }),
      { numRuns: 200 },
    )
  })

  it('relativeAngle always lands in (-180, 180]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 360, noNaN: true }),
        fc.double({ min: 0, max: 360, noNaN: true }),
        (bearing, heading) => {
          const rel = relativeAngle(bearing, heading)
          expect(rel).toBeGreaterThan(-180)
          expect(rel).toBeLessThanOrEqual(180)
        },
      ),
      { numRuns: 200 },
    )
  })
})
