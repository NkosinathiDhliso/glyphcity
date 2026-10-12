/**
 * Feature: North star alignment, Property 5 (type half): beam brightness cannot
 * see taste (north-star-alignment R6.3).
 *
 * A beam's height and opacity are read from the venue's Pulse_State alone
 * (`constellation-mode.md`). The taste aurora is a separate layer, so these
 * pin that the brightness inputs take a NodeState and nothing else.
 *
 * The web tsconfig excludes test files, so the `expectTypeOf` lines document
 * the contract and the runtime lines enforce it.
 */
import type { NodeState } from '@area-code/shared/types'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { BEAM_HEIGHT, BEAM_OPACITY, beamHeightForState } from '../markerBeam'

const STATES: NodeState[] = ['dormant', 'quiet', 'active', 'buzzing', 'popping']

describe('beam brightness input (R6.3)', () => {
  it('reads height from the state alone', () => {
    expectTypeOf(beamHeightForState).parameters.toEqualTypeOf<[NodeState]>()
    expect(beamHeightForState.length).toBe(1)
    for (const state of STATES) {
      expect(beamHeightForState(state)).toBe(BEAM_HEIGHT[state])
    }
  })

  it('keys height and opacity by state alone', () => {
    expectTypeOf(BEAM_HEIGHT).toEqualTypeOf<Record<NodeState, number>>()
    expectTypeOf(BEAM_OPACITY).toEqualTypeOf<Record<NodeState, number>>()
    expect(Object.keys(BEAM_HEIGHT).sort()).toEqual([...STATES].sort())
    expect(Object.keys(BEAM_OPACITY).sort()).toEqual([...STATES].sort())
  })
})
